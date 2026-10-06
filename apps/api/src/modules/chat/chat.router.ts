import { Router, type NextFunction, type Request, type Response } from "express";
import { chatRequestSchema, chatResponseSchema, type ChatRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { problemRepository } from "../../infrastructure/persistence/problemRepository";
import { resolveSolutionContext } from "../../infrastructure/store/resolveSolutionContext";
import { getRequestUser } from "../../shared/lib/request-user";

function createHandleChat(adapter: LLMAdapter) {
  return async function handleChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { problemId } = req.params as { problemId: string };
    const { question, history } = req.body as ChatRequestDto;

    const userId = getRequestUser(req)?.id;
    if (!userId) {
      next(new AppError("unauthorized", "인증이 필요합니다.", 401));
      return;
    }

    try {
      const { problem, solution, grade } = resolveSolutionContext(problemId, userId);

      const answerMd = await adapter.chat({ problem, solution, history, question, grade });

      // 질문/답변 한 턴을 best-effort로 영구 저장한다(실패해도 throw하지 않는다).
      await problemRepository.saveChatTurn({ problemId, question, answer: answerMd });

      const responseBody = chatResponseSchema.parse({ answerMd });

      res.status(200).json(responseBody);
    } catch (error) {
      next(error);
    }
  };
}

/** `createSolutionsRouter`와 동일한 이유로 adapter를 주입 가능하게 한다. */
export function createChatRouter(adapter: LLMAdapter = resolveAdapter()): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/chat",
    authenticate,
    rateLimiter,
    validateRequest(chatRequestSchema),
    createHandleChat(adapter),
  );

  return router;
}
