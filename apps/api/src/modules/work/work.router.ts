import { Router, type NextFunction, type Request, type Response } from "express";
import type { Grade } from "shared-types";
import { workLinesResponseSchema } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";
import { uploadProblemImage } from "../recognition/upload";

function requireImageFile(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
    return;
  }
  next();
}

/**
 * `problemId`로 저장소에서 학년(grade)을 조회한다. `solutions.router.ts`의 `resolveProblem`과
 * 동일한 소유권 검증 규칙(대상 없거나 다른 사용자 소유면 404)을 따른다.
 */
function resolveGrade(problemId: string, userId: string): Grade {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored || stored.userId !== userId) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  return stored.grade;
}

function createHandleRecognizeWork(adapter: LLMAdapter) {
  return async function handleRecognizeWork(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { problemId } = req.params as { problemId: string };

    const userId = getRequestUser(req)?.id;
    if (!userId) {
      next(new AppError("unauthorized", "인증이 필요합니다.", 401));
      return;
    }

    let grade: Grade;
    try {
      grade = resolveGrade(problemId, userId);
    } catch (error) {
      next(error);
      return;
    }

    const imageBuffer = req.file?.buffer;
    if (!imageBuffer) {
      next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
      return;
    }

    try {
      const workLines = await adapter.recognizeWork(imageBuffer, grade);
      inMemoryProblemStore.setWorkLines(problemId, workLines);

      const responseBody = workLinesResponseSchema.parse({ workLines });
      res.status(200).json(responseBody);
    } catch (error) {
      next(error);
    }
  };
}

/** `createRecognitionRouter`와 동일한 이유로 adapter를 주입 가능하게 한다. */
export function createWorkRouter(adapter: LLMAdapter = resolveAdapter()): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/work-lines",
    authenticate,
    rateLimiter,
    uploadProblemImage,
    requireImageFile,
    createHandleRecognizeWork(adapter),
  );

  return router;
}
