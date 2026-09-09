import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  bulkDeleteProblemsRequestSchema,
  bulkDeleteProblemsResponseSchema,
  problemHistoryDetailSchema,
  problemHistoryListResponseSchema,
  recognizeResponseSchema,
  type BulkDeleteProblemsRequestDto,
} from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
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
 * 마이페이지의 "다시 풀기": DB에 영구 저장된 인식 결과로 **새 problemId**를 발급해
 * inMemoryProblemStore/DB에 새 문제로 등록한다.
 *
 * 원래 problemId를 그대로 재사용하지 않는 이유(Final QA HIGH-1 지적): solve가 끝나면
 * `saveSolution`이 `problem_id`에 upsert하므로, 같은 id를 그대로 쓰면 재풀이 결과가 원본
 * 풀이/대화 기록을 덮어써 버려 MYPAGE-3("저장 시점 내용과 동일하게 재현")를 깨뜨린다. 새 id를
 * 쓰면 원본 기록은 그대로 남고, 재풀이는 별도의 새 이력 항목으로 쌓인다.
 *
 * `saveProblem`이 요구하는 `inputType`은 과거 기록 조회 응답에 없다(사진/필기 원본 이미지를
 *애초에 저장하지 않는 설계라 이 값을 알 방법이 없다) — 화면에도 이 구분이 전혀 노출되지 않으므로
 * (Figma 실측에도 없음), 재풀이 항목은 `"handwriting"`으로 고정한다(결정 필요 — 오너가 실제
 * 원본 방식을 구분해서 보여줘야 한다고 판단하면 `problems` 테이블 조회에 `input_type`을
 * 추가해야 함).
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

  const { problemId: sourceProblemId } = req.params as { problemId: string };

  let detail: Awaited<ReturnType<typeof problemRepository.getProblemDetail>>;
  try {
    detail = await problemRepository.getProblemDetail(userId, sourceProblemId);
  } catch (error) {
    next(historyQueryFailed("getProblemDetail", error));
    return;
  }

  if (!detail) {
    next(new AppError("validation_error", "풀이 기록을 찾을 수 없습니다.", 404));
    return;
  }

  const problemId = randomUUID();
  const createdAt = new Date().toISOString();
  const problem = {
    recognizedText: detail.recognizedText,
    recognizedLatex: detail.recognizedLatex,
  };

  inMemoryProblemStore.set({ problemId, userId, grade, problem, createdAt });
  // best-effort 영구 저장 — 실패해도 throw하지 않으므로 응답에 영향 없다(saveProblem 계약대로).
  // 이 호출이 없으면 solve 완료 시 saveSolution이 문제 행이 없어 FK 위반으로 조용히 실패한다.
  await problemRepository.saveProblem({
    problemId,
    userId,
    grade,
    inputType: "handwriting",
    problem,
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
 * 마이페이지 개선 3번(체크박스 일괄 삭제). `DELETE /api/problems` 대신 이 라우터의 다른 액션형
 * 엔드포인트(`POST /api/problems/:problemId/reopen`)와 동일한 POST 액션 경로 컨벤션을 따른다.
 *
 * 요청에 포함된 `problemId` 중 일부가 존재하지 않거나 타인 소유여도 에러로 처리하지 않는다 —
 * 저장소가 본인 소유로 확인된 항목만 삭제하고 그 목록만 돌려준다(`getProblemDetail`과 동일한
 * 정보 비노출 원칙). 다만 **요청한 항목이 하나도 삭제되지 않았다면**(전부 없거나 타인 소유)
 * `getProblemDetail`이 없음/타인 소유를 구분하지 않고 404를 응답하는 것과 동일하게 404로
 * 응답한다.
 */
async function handleBulkDeleteProblems(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getRequestUser(req)?.id;
  if (!userId) {
    next(new AppError("unauthorized", "인증이 필요합니다.", 401));
    return;
  }

  const { problemIds } = req.body as BulkDeleteProblemsRequestDto;

  let deletedProblemIds: string[];
  try {
    deletedProblemIds = await problemRepository.deleteProblems(userId, problemIds);
  } catch (error) {
    next(historyQueryFailed("deleteProblems", error));
    return;
  }

  if (deletedProblemIds.length === 0) {
    next(new AppError("validation_error", "삭제할 풀이 기록을 찾을 수 없습니다.", 404));
    return;
  }

  res.status(200).json(bulkDeleteProblemsResponseSchema.parse({ deletedProblemIds }));
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
  router.post(
    "/problems/bulk-delete",
    authenticate,
    rateLimiter,
    validateRequest(bulkDeleteProblemsRequestSchema),
    handleBulkDeleteProblems,
  );

  return router;
}
