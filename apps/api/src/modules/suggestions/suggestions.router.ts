import { Router, type NextFunction, type Request, type Response } from "express";
import type { Grade, RecognizedProblem, Solution } from "shared-types";
import { suggestedQuestionsResponseSchema } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";

interface ResolvedSuggestContext {
  problem: RecognizedProblem;
  solution: Solution;
  grade: Grade;
}

/**
 * `problemId`로 문제/최초 풀이 컨텍스트를 조회한다. `chat.router.ts`의 `resolveChatContext`와
 * 동일한 규칙(소유자가 다르거나 없으면 404, 풀이가 아직 없으면 400) — Final QA BLOCKER-1 이후
 * 신설되는 라우트는 처음부터 소유권 검증을 포함한다.
 */
function resolveSuggestContext(problemId: string, userId: string): ResolvedSuggestContext {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored || stored.userId !== userId) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  if (!stored.solution) {
    throw new AppError(
      "validation_error",
      `문제(${problemId})의 풀이가 아직 없습니다. 먼저 풀이를 완료해주세요.`,
      400,
    );
  }

  return { problem: stored.problem, solution: stored.solution, grade: stored.grade };
}

function createHandleSuggestQuestions(adapter: LLMAdapter) {
  return async function handleSuggestQuestions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const userId = getRequestUser(req)?.id;
    if (!userId) {
      next(new AppError("unauthorized", "인증이 필요합니다.", 401));
      return;
    }

    const { problemId } = req.params as { problemId: string };

    try {
      const { problem, solution, grade } = resolveSuggestContext(problemId, userId);
      const questions = await adapter.suggestQuestions({ problem, solution, grade });
      res.status(200).json(suggestedQuestionsResponseSchema.parse({ questions }));
    } catch (error) {
      next(error);
    }
  };
}

/** `createChatRouter`와 동일한 이유로 adapter를 주입 가능하게 한다. */
export function createSuggestionsRouter(adapter: LLMAdapter = resolveAdapter()): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/suggestions",
    authenticate,
    rateLimiter,
    createHandleSuggestQuestions(adapter),
  );

  return router;
}
