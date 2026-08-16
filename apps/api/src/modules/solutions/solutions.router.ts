import { Router, type NextFunction, type Request, type Response } from "express";
import type { Grade, RecognizedProblem } from "shared-types";
import { solveRequestSchema, type SolveRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";

interface ResolvedProblem {
  problem: RecognizedProblem;
  grade: Grade;
}

function resolveProblem(problemId: string, confirmedText: string | undefined): ResolvedProblem {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  const problem: RecognizedProblem =
    confirmedText !== undefined
      ? { recognizedText: confirmedText, recognizedLatex: stored.problem.recognizedLatex }
      : stored.problem;

  return { problem, grade: stored.grade };
}

function createHandleSolve(adapter: LLMAdapter) {
  return async function handleSolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { problemId } = req.params as { problemId: string };
    const { options, confirmedText } = req.body as SolveRequestDto;

    let resolved: ResolvedProblem;
    try {
      resolved = resolveProblem(problemId, confirmedText);
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
      for await (const event of adapter.solve({
        problem: resolved.problem,
        options,
        grade: resolved.grade,
      })) {
        if ("delta" in event) {
          res.write(`event: chunk\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`);
        } else {
          inMemoryProblemStore.setSolution(problemId, event.result);
          res.write(`event: done\ndata: ${JSON.stringify(event.result)}\n\n`);
        }
      }
    } catch {
      res.write(
        `event: error\ndata: ${JSON.stringify({ code: "provider_error", message: "풀이 생성 중 오류가 발생했습니다." })}\n\n`,
      );
    } finally {
      res.end();
    }
  };
}

/** `createRecognitionRouter`와 동일한 이유로 adapter를 주입 가능하게 한다. */
export function createSolutionsRouter(adapter: LLMAdapter = resolveAdapter()): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/solve",
    authenticate,
    rateLimiter,
    validateRequest(solveRequestSchema),
    createHandleSolve(adapter),
  );

  return router;
}
