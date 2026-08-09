import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { recognizeRequestSchema, recognizeResponseSchema, type RecognizeRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";
import { uploadProblemImage } from "./upload";

function requireImageFile(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
    return;
  }
  next();
}

function createHandleRecognize(adapter: LLMAdapter) {
  return async function handleRecognize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // validateRequest 미들웨어가 이미 검증·치환한 값이므로 안전하게 단언한다.
      const { grade } = req.body as RecognizeRequestDto;
      const imageBuffer = req.file?.buffer;

      if (!imageBuffer) {
        next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
        return;
      }

      const recognized = await adapter.recognizeProblem(imageBuffer, grade);

      const problemId = randomUUID();
      const createdAt = new Date().toISOString();

      inMemoryProblemStore.set({
        problemId,
        userId: getRequestUser(req)?.id ?? "unknown",
        grade,
        problem: recognized,
        createdAt,
      });

      const responseBody = recognizeResponseSchema.parse({
        problemId,
        recognizedText: recognized.recognizedText,
        recognizedLatex: recognized.recognizedLatex,
        createdAt,
      });

      res.status(200).json(responseBody);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * `adapter`를 명시적으로 주입할 수 있게 해서 테스트가 실제 provider 환경변수와 무관하게
 * `FakeLLMAdapter`를 결정적으로 사용할 수 있게 한다. 인자를 생략하면(운영 기본값)
 * `resolveAdapter()`가 `AI_PROVIDER` 환경변수를 보고 실제 어댑터를 고른다.
 */
export function createRecognitionRouter(adapter: LLMAdapter = resolveAdapter()): Router {
  const router = Router();

  router.post(
    "/problems/recognize",
    authenticate,
    rateLimiter,
    uploadProblemImage,
    requireImageFile,
    validateRequest(recognizeRequestSchema),
    createHandleRecognize(adapter),
  );

  return router;
}
