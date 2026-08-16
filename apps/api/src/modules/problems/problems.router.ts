import { Router, type NextFunction, type Request, type Response } from "express";
import {
  problemHistoryDetailSchema,
  problemHistoryListResponseSchema,
  recognizeResponseSchema,
} from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { AppError } from "../../shared/errors/AppError";
import { problemRepository } from "../../infrastructure/persistence/problemRepository";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";

/** 조회 실패는 원본 에러를 서버 로그에만 남기고 클라이언트에는 일반 메시지만 노출한다. */
function historyQueryFailed(operation: string, error: unknown): AppError {
  console.error(`[problems.router] ${operation} 실패`, error);
  return new AppError("internal_error", "풀이 기록을 불러오지 못했습니다.", 500);
}

async function handleListProblems(req: Request, res: Response, next: NextFunction): Promise<void> {
  // authenticate가 항상 채우지만, 방어적으로 확인한다.
  const userId = getRequestUser(req)?.id;
  if (!userId) {
    next(new AppError("unauthorized", "인증이 필요합니다.", 401));
    return;
  }

  try {
    const items = await problemRepository.listProblems(userId);
    res.status(200).json(problemHistoryListResponseSchema.parse({ items }));
  } catch (error) {
    next(historyQueryFailed("listProblems", error));
  }
}

async function handleGetProblemDetail(
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

  let detail: Awaited<ReturnType<typeof problemRepository.getProblemDetail>>;
  try {
    detail = await problemRepository.getProblemDetail(userId, problemId);
  } catch (error) {
    next(historyQueryFailed("getProblemDetail", error));
    return;
  }

  // 존재하지 않는 문제와 타인 소유 문제를 구분하지 않고 동일하게 404로 응답한다(정보 노출 방지).
  if (!detail) {
    next(new AppError("validation_error", "풀이 기록을 찾을 수 없습니다.", 404));
    return;
  }

  res.status(200).json(problemHistoryDetailSchema.parse(detail));
}

/**
 * 마이페이지의 "다시 풀기": DB에 영구 저장된 인식 결과로 inMemoryProblemStore를 다시 채운다.
 * solve 라우트가 문제 데이터를 메모리 저장소에서만 찾기 때문에, 서버 재시작 등으로
 * 엔트리가 사라진 과거 문제도 재입력 없이 곧바로 다시 풀 수 있게 하기 위함이다.
 */
async function handleReopenProblem(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = getRequestUser(req);
  const userId = user?.id;
  if (!userId) {
    next(new AppError("unauthorized", "인증이 필요합니다.", 401));
    return;
  }

  // 저장 당시 학년이 아니라 현재 학년을 쓴다(진급했다면 현재 학년 기준 설명이 더 적합하다).
  const grade = user.grade;
  if (!grade) {
    next(new AppError("validation_error", "학년 정보가 필요합니다.", 400));
    return;
  }

  const { problemId } = req.params as { problemId: string };

  let detail: Awaited<ReturnType<typeof problemRepository.getProblemDetail>>;
  try {
    detail = await problemRepository.getProblemDetail(userId, problemId);
  } catch (error) {
    next(historyQueryFailed("getProblemDetail", error));
    return;
  }

  if (!detail) {
    next(new AppError("validation_error", "풀이 기록을 찾을 수 없습니다.", 404));
    return;
  }

  const createdAt = new Date().toISOString();
  inMemoryProblemStore.set({
    problemId,
    userId,
    grade,
    problem: {
      recognizedText: detail.recognizedText,
      recognizedLatex: detail.recognizedLatex,
    },
    createdAt,
  });

  res.status(200).json(
    recognizeResponseSchema.parse({
      problemId,
      recognizedText: detail.recognizedText,
      recognizedLatex: detail.recognizedLatex,
      createdAt,
    }),
  );
}

/**
 * 마이페이지 풀이 이력 조회 라우터.
 * AI 어댑터를 쓰지 않는 순수 조회 라우트라 다른 라우터와 달리 `adapter` 파라미터가 없다.
 */
export function createProblemsRouter(): Router {
  const router = Router();

  router.get("/problems", authenticate, rateLimiter, handleListProblems);
  router.get("/problems/:problemId", authenticate, rateLimiter, handleGetProblemDetail);
  router.post("/problems/:problemId/reopen", authenticate, rateLimiter, handleReopenProblem);

  return router;
}
