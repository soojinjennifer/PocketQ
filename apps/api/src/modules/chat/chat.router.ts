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
import { env } from "../../config/env";
import { buildChatFigureContext, capChatHistory } from "./chatContext";

/** chat 라우터 주입 옵션(테스트·운영 공통). */
export interface ChatRouteOptions {
  /** 기본값 `env.figuresEnabled`. off면 history 절단·도형 맥락 모두 없음 — `adapter.chat` 인자가 기존과 같다. */
  figuresEnabled?: boolean;
}

function createHandleChat(adapter: LLMAdapter, figuresEnabled: boolean) {
  return async function handleChat(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { problemId } = req.params as { problemId: string };
    const { question, history, figureContext } = req.body as ChatRequestDto;

    const userId = getRequestUser(req)?.id;
    if (!userId) {
      next(new AppError("unauthorized", "인증이 필요합니다.", 401));
      return;
    }

    try {
      const context = resolveSolutionContext(problemId, userId);
      const { problem, solution, grade } = context;

      // Stage 5(on 전용): history 상한(S5-D5)과 검증 도형 맥락(S5-D6). 도형은 서버 메모리 값만 — 요청에서 받지 않는다.
      const chatFigureContext = figuresEnabled
        ? buildChatFigureContext(solution, context.figures, figureContext?.step ?? null)
        : null;
      const answerMd = await adapter.chat({
        problem,
        solution,
        history: figuresEnabled ? capChatHistory(history) : history,
        question,
        grade,
        ...(chatFigureContext ? { figureContext: chatFigureContext } : {}),
      });

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
export function createChatRouter(
  adapter: LLMAdapter = resolveAdapter(),
  { figuresEnabled = env.figuresEnabled }: ChatRouteOptions = {},
): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/chat",
    authenticate,
    rateLimiter,
    validateRequest(chatRequestSchema),
    createHandleChat(adapter, figuresEnabled),
  );

  return router;
}
