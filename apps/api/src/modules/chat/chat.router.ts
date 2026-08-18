import { Router, type NextFunction, type Request, type Response } from "express";
import type { Grade, RecognizedProblem, Solution } from "shared-types";
import { chatRequestSchema, chatResponseSchema, type ChatRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { problemRepository } from "../../infrastructure/persistence/problemRepository";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";

interface ResolvedChatContext {
  problem: RecognizedProblem;
  solution: Solution;
  grade: Grade;
}

/**
 * `problemId`로 저장소에서 문제/최초 풀이 컨텍스트를 모두 조회한다.
 * 문제 자체가 없거나(잘못된 problemId) 다른 사용자 소유면 동일하게 404, 문제는 있지만 solve가
 * 아직 끝나지 않아 풀이가 없으면(예: solve 진행 전에 chat을 먼저 호출) 별도로 구분해 400을 던진다.
 * 소유권 검증은 Final QA(BLOCKER-1) 지적 반영 — 없으면 다른 사용자의 problemId로 그 사람의
 * 대화 기록에 메시지를 끼워넣을 수 있었다.
 */
function resolveChatContext(problemId: string, userId: string): ResolvedChatContext {
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
      const { problem, solution, grade } = resolveChatContext(problemId, userId);

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
