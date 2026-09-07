import { Router, type NextFunction, type Request, type Response } from "express";
import type { Diagnosis, Grade, ResumeMode, WorkLine } from "shared-types";
import { resumeRequestSchema, type ResumeRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import type { CasClient } from "../../infrastructure/cas/casClient";
import { resolveCasClient } from "../../infrastructure/cas/resolveCasClient";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";

interface ResolvedResumeContext {
  problemText: string;
  workLines: WorkLine[];
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
    diagnosis: stored.diagnosis,
    grade: stored.grade,
  };
}

function createHandleResume(adapter: LLMAdapter, casClient: CasClient) {
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

    try {
      for await (const event of adapter.resume({
        problem: resolved.problemText,
        workLines: resolved.workLines,
        diagnosis: resolved.diagnosis,
        mode,
        grade: resolved.grade,
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
          res.write(`event: done\ndata: ${JSON.stringify(result)}\n\n`);
        } else {
          res.write(`event: error\ndata: ${JSON.stringify({ code: "provider_error", message: event.error })}\n\n`);
        }
      }
    } catch {
      res.write(
        `event: error\ndata: ${JSON.stringify({ code: "provider_error", message: "이어풀기 생성 중 오류가 발생했습니다." })}\n\n`,
      );
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
): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/resume",
    authenticate,
    rateLimiter,
    validateRequest(resumeRequestSchema),
    createHandleResume(adapter, casClient),
  );

  return router;
}
