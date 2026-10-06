import { Router, type NextFunction, type Request, type Response } from "express";
import { suggestedQuestionsResponseSchema } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { resolveSolutionContext } from "../../infrastructure/store/resolveSolutionContext";
import { getRequestUser } from "../../shared/lib/request-user";

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
      const { problem, solution, grade } = resolveSolutionContext(problemId, userId);
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
