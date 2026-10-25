import { Router, type NextFunction, type Request, type Response } from "express";
import type { Diagnosis, Grade, ResumeMode, ResumeSolution, ResumeWorkContext, WorkLine } from "shared-types";
import { resumeRequestSchema, type ResumeRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import type { CasClient } from "../../infrastructure/cas/casClient";
import { resolveCasClient } from "../../infrastructure/cas/resolveCasClient";
import { problemRepository } from "../../infrastructure/persistence/problemRepository";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";
import { env } from "../../config/env";
import { buildPriorWork } from "../../infrastructure/ai/prompts/figures";
import { generateSolutionFigures } from "../figures/generateSolutionFigures";
import { abortOnClientClose, streamFiguresPhase, type FiguresRouteOptions } from "../figures/streamFigures";

/** resume 라우터 주입 옵션(테스트·운영 공통). */
export interface ResumeRouteOptions extends FiguresRouteOptions {
  /** 기본값 `env.resumePersistEnabled`(`RESUME_PERSIST_ENABLED === "true"`). off면 저장소 호출 0(RS1). */
  resumePersistEnabled?: boolean;
}

/**
 * CAS 검증을 통과한 결과를 `resume_solutions`에 저장한다(Stage 5, done **직전**). 어떤 실패·throw도 삼킨다 —
 * done 전송을 막지 않는다(RS9). `ai_provider`/`ai_model`은 어댑터가 노출하지 않아 `toSolutionFromResume`과 같은
 * 환경변수 값을 쓴다(**결정 필요**: 어댑터에 공급자·모델 조회가 생기면 그 값으로 바꾼다).
 */
async function persistVerifiedResume(
  problemId: string,
  result: ResumeSolution,
  workContext: ResumeWorkContext | null,
): Promise<void> {
  if (result.verified !== true) return;
  try {
    await problemRepository.saveResumeSolution({
      problemId,
      resumeSolution: result,
      aiProvider: env.aiProvider ?? "openai",
      aiModel: env.aiModel,
      workContext,
    });
  } catch (error) {
    console.error("[resume.router] 이어풀기 결과 저장 실패", error);
  }
}

/**
 * 저장할 진단 맥락(§12.1·§12.2): 진단에 실제로 쓴 줄(`diagnosedWorkLines`, 없으면 인식 원본 `workLines`)을 lineNo 순으로,
 * 진단 근거 2값과 함께. 줄이 없으면 null. 상한·형식 검사는 저장소가 한다(실패 시 세 값 null).
 */
function buildWorkContext(lines: readonly WorkLine[], diagnosis: Diagnosis): ResumeWorkContext | null {
  if (lines.length === 0) return null;
  return {
    lines: [...lines].sort((a, b) => a.lineNo - b.lineNo).map((line) => ({ lineNo: line.lineNo, latex: line.latex })),
    lastValidLine: diagnosis.lastValidLine,
    stallLine: diagnosis.stallLine,
  };
}

interface ResolvedResumeContext {
  problemText: string;
  workLines: WorkLine[];
  /** 진단에 실제로 쓴 줄(저장 전용, 프롬프트·priorWork에는 쓰지 않는다). */
  diagnosedWorkLines: WorkLine[] | null;
  diagnosis: Diagnosis;
  grade: Grade;
}

/**
 * `problemId`로 저장소에서 문제 원문/줄 단위 풀이/진단 결과/학년을 조회한다.
 * `diagnosis.router.ts`의 `resolveDiagnoseContext`와 동일한 소유권 검증 규칙(대상 없거나 다른
 * 사용자 소유면 404)을 따르되, 진단이 아직 끝나지 않은 문제(아직 `diagnosis`가 없는 경우)도
 * 동일하게 404로 처리한다 — RESUME은 반드시 DIAG 이후에만 호출 가능하다.
 *
 * RESUME-4 서버 측 방어(stage-qa-agent 회귀 지적, 2026-09): 프론트가 `diagnosis.isMethodApplicable
 * === false`일 때 "내 방법으로 계속" 버튼을 비활성화하지만, 이는 클라이언트 숨김일 뿐 방어가
 * 아니다. 클라이언트가 검증을 우회해 `mode: "own"`으로 직접 요청해도 동일한 진단 결과라면 서버가
 * 400으로 거부해야 한다.
 */
function resolveResumeContext(problemId: string, userId: string, mode: ResumeMode): ResolvedResumeContext {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored || stored.userId !== userId) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  if (!stored.diagnosis) {
    throw new AppError("validation_error", `문제(${problemId})의 진단 결과를 찾을 수 없습니다.`, 404);
  }

  if (mode === "own" && !stored.diagnosis.isMethodApplicable) {
    throw new AppError(
      "validation_error",
      "이 방법으로는 이어갈 수 없습니다. 다른 방법으로 다시 시도해 주세요.",
      400,
    );
  }

  return {
    problemText: stored.problem.recognizedText,
    workLines: stored.workLines ?? [],
    diagnosedWorkLines: stored.diagnosedWorkLines ?? null,
    diagnosis: stored.diagnosis,
    grade: stored.grade,
  };
}

function createHandleResume(
  adapter: LLMAdapter,
  casClient: CasClient,
  figures: Required<Pick<ResumeRouteOptions, "figuresEnabled" | "resumePersistEnabled">> & ResumeRouteOptions,
) {
  return async function handleResume(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { problemId } = req.params as { problemId: string };
    const { mode } = req.body as ResumeRequestDto;

    const userId = getRequestUser(req)?.id;
    if (!userId) {
      next(new AppError("unauthorized", "인증이 필요합니다.", 401));
      return;
    }

    let resolved: ResolvedResumeContext;
    try {
      resolved = resolveResumeContext(problemId, userId, mode);
    } catch (error) {
      next(error);
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 도형 시각화 off면 아래 figures 관련 분기는 모두 건너뛴다 — 요청·SSE 바이트가 기존과 같다(S3-R1).
    const figureAbort = figures.figuresEnabled ? abortOnClientClose(res) : null;
    let doneResult: ResumeSolution | null = null;

    try {
      for await (const event of adapter.resume({
        problem: resolved.problemText,
        workLines: resolved.workLines,
        diagnosis: resolved.diagnosis,
        mode,
        grade: resolved.grade,
        ...(figures.figuresEnabled ? { stepMarkers: true } : {}),
      })) {
        if ("delta" in event) {
          res.write(`event: chunk\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`);
        } else if ("done" in event) {
          // RESUME-5: CAS 최종 답 검증 결과로 verified를 확정한 뒤에 done을 보낸다.
          // `resolved.diagnosis.problemAnswerLatex`(diagnose 시점에 LLM이 생성한 원 문제 정답)를
          // 기준값으로, `event.result.answerMd`(이어풀기 최종 답, `parseResumeOutput`이 이미
          // solutionMd와 분리해둔 값)를 CAS에 넘겨 대수적 동치 여부를 검증한다.
          const { verified } = await casClient.verifyFinalAnswer(
            resolved.diagnosis.problemAnswerLatex,
            event.result.answerMd,
          );
          const result = { ...event.result, verified };
          inMemoryProblemStore.setResumeSolution(problemId, result);
          // Stage 5: verified 결과만 done 직전에 저장한다(RESUME_PERSIST off면 저장소 호출 0). SSE 바이트는 그대로다.
          if (figures.resumePersistEnabled) {
            await persistVerifiedResume(
              problemId,
              result,
              buildWorkContext(resolved.diagnosedWorkLines ?? resolved.workLines, resolved.diagnosis),
            );
          }
          res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
          doneResult = result;
        } else if (!(figureAbort && doneResult)) {
          res.write(`event: error\ndata: ${JSON.stringify({ code: "provider_error", message: event.error })}\n\n`);
        }
      }

      // done 이후 도형 단계(on 전용). priorWork는 own 모드의 학생 유효 구간만(alternative는 null).
      const resumed = doneResult;
      if (figureAbort && resumed) {
        await streamFiguresPhase(
          res,
          () =>
            generateSolutionFigures({
              adapter,
              source: "resume",
              mode,
              grade: resolved.grade,
              problemText: resolved.problemText,
              priorWork: buildPriorWork(mode, resolved.workLines, resolved.diagnosis),
              solutionMd: resumed.solutionMd,
              answerMd: resumed.answerMd,
              signal: figureAbort.signal,
              ...(figures.figuresTotalBudgetMs !== undefined ? { totalBudgetMs: figures.figuresTotalBudgetMs } : {}),
            }),
          figures.keepAliveMs,
          // Stage 5: 보낸 도형을 이 실행의 이어풀기 결과에 연결(CHAT용 메모리)하고, verified 결과만 영속 저장한다
          // (RESUME_PERSIST + FIGURES_PERSIST + 테이블 탐지 + run id 일치일 때만 쓰기, best-effort).
          async (accepted) => {
            inMemoryProblemStore.attachResumeFigures(problemId, resumed, accepted);
            if (figures.resumePersistEnabled && resumed.verified) {
              await problemRepository.saveResumeFigures({ problemId, resumeSolution: resumed, ...accepted });
            }
          },
        );
      }
    } catch {
      // on에서 done을 이미 보냈다면 error를 보내지 않는다(done 뒤 error 금지). off는 기존 동작 그대로.
      if (!(figureAbort && doneResult)) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ code: "provider_error", message: "이어풀기 생성 중 오류가 발생했습니다." })}\n\n`,
        );
      }
    } finally {
      res.end();
    }
  };
}

/**
 * `createSolutionsRouter`와 동일한 이유로 adapter를 주입 가능하게 한다. `casClient`도 동일한
 * 이유(테스트 용이성)로 주입 가능하다.
 */
export function createResumeRouter(
  adapter: LLMAdapter = resolveAdapter(),
  casClient: CasClient = resolveCasClient(),
  {
    figuresEnabled = env.figuresEnabled,
    resumePersistEnabled = env.resumePersistEnabled,
    ...figureOptions
  }: ResumeRouteOptions = {},
): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/resume",
    authenticate,
    rateLimiter,
    validateRequest(resumeRequestSchema),
    createHandleResume(adapter, casClient, { figuresEnabled, resumePersistEnabled, ...figureOptions }),
  );

  return router;
}
