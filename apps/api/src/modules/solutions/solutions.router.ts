import { Router, type NextFunction, type Request, type Response } from "express";
import type { Grade, RecognizedProblem, Solution } from "shared-types";
import { solveRequestSchema, type SolveRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { problemRepository } from "../../infrastructure/persistence/problemRepository";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";
import { env } from "../../config/env";
import { generateSolutionFigures } from "../figures/generateSolutionFigures";
import { abortOnClientClose, streamFiguresPhase, type FiguresRouteOptions } from "../figures/streamFigures";

interface ResolvedProblem {
  problem: RecognizedProblem;
  grade: Grade;
}

/**
 * `userId`가 저장된 소유자와 다르면 존재하지 않는 문제와 동일하게 404를 던진다(정보 노출 방지,
 * `problems.router.ts`의 `getProblemDetail` 소유권 검증과 동일 패턴) — Final QA(BLOCKER-1)가
 * 지적한 대로, 이 검증이 없으면 다른 사용자의 problemId로 풀이를 조회/덮어쓸 수 있었다.
 */
function resolveProblem(
  problemId: string,
  userId: string,
  confirmedText: string | undefined,
): ResolvedProblem {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored || stored.userId !== userId) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  const problem: RecognizedProblem =
    confirmedText !== undefined
      ? { recognizedText: confirmedText, recognizedLatex: stored.problem.recognizedLatex }
      : stored.problem;

  return { problem, grade: stored.grade };
}

function createHandleSolve(adapter: LLMAdapter, figures: Required<Pick<FiguresRouteOptions, "figuresEnabled">> & FiguresRouteOptions) {
  return async function handleSolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { problemId } = req.params as { problemId: string };
    const { options, confirmedText } = req.body as SolveRequestDto;

    const userId = getRequestUser(req)?.id;
    if (!userId) {
      next(new AppError("unauthorized", "인증이 필요합니다.", 401));
      return;
    }

    let resolved: ResolvedProblem;
    try {
      resolved = resolveProblem(problemId, userId, confirmedText);
    } catch (error) {
      next(error);
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 도형 시각화 off면 아래 figures 관련 분기는 모두 건너뛴다 — 요청·SSE 바이트가 기존과 같다(S3-1).
    const figureAbort = figures.figuresEnabled ? abortOnClientClose(res) : null;
    let doneResult: Solution | null = null;

    try {
      for await (const event of adapter.solve({
        problem: resolved.problem,
        options,
        grade: resolved.grade,
        ...(figures.figuresEnabled ? { stepMarkers: true } : {}),
      })) {
        if ("delta" in event) {
          res.write(`event: chunk\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`);
        } else {
          inMemoryProblemStore.setSolution(problemId, event.result);
          // best-effort 영구 저장. saveSolution은 절대 throw하지 않으므로
          // 아래 catch(어댑터 에러용)에 걸려 error 이벤트를 오발생시키지 않는다.
          await problemRepository.saveSolution({ problemId, solution: event.result });
          res.write(`event: done\ndata: ${JSON.stringify(event.result)}\n\n`);
          doneResult = event.result;
        }
      }

      // done 이후 도형 단계(on 전용). 텍스트 풀이는 이미 전달·저장됐다 — 도형 실패는 error 이벤트 없이 끝난다.
      const solved = doneResult;
      if (figureAbort && solved) {
        await streamFiguresPhase(
          res,
          () =>
            generateSolutionFigures({
              adapter,
              source: "solve",
              mode: null,
              grade: resolved.grade,
              problemText: resolved.problem.recognizedText,
              priorWork: null,
              solutionMd: solved.solutionMd,
              answerMd: solved.answerMd,
              signal: figureAbort.signal,
              ...(figures.figuresTotalBudgetMs !== undefined ? { totalBudgetMs: figures.figuresTotalBudgetMs } : {}),
            }),
          figures.keepAliveMs,
          // Stage 5: 보낸 도형을 이 실행의 풀이에 연결(CHAT용 메모리, 재풀이됐으면 무시)하고 영속 저장한다
          // (`FIGURES_PERSIST_ENABLED` + 컬럼 탐지 + run id 일치일 때만 쓰기, best-effort).
          async (accepted) => {
            inMemoryProblemStore.attachSolutionFigures(problemId, solved, accepted);
            await problemRepository.saveSolutionFigures({ problemId, solution: solved, ...accepted });
          },
        );
      }
    } catch {
      // on에서 done을 이미 보냈다면 error를 보내지 않는다(done 뒤 error 금지). off는 기존 동작 그대로.
      if (!(figureAbort && doneResult)) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ code: "provider_error", message: "풀이 생성 중 오류가 발생했습니다." })}\n\n`,
        );
      }
    } finally {
      res.end();
    }
  };
}

/**
 * `createRecognitionRouter`와 동일한 이유로 adapter를 주입 가능하게 한다. `options.figuresEnabled`는
 * 기본 `env.figuresEnabled`(운영 기본 off)이며 테스트가 on/off를 직접 주입한다.
 */
export function createSolutionsRouter(
  adapter: LLMAdapter = resolveAdapter(),
  { figuresEnabled = env.figuresEnabled, ...figureOptions }: FiguresRouteOptions = {},
): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/solve",
    authenticate,
    rateLimiter,
    validateRequest(solveRequestSchema),
    createHandleSolve(adapter, { figuresEnabled, ...figureOptions }),
  );

  return router;
}
