import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { recognizeRequestSchema, recognizeResponseSchema, type RecognizeRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";
import { uploadProblemImage } from "./upload";

export const recognitionRouter: Router = Router();

function requireImageFile(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
    return;
  }
  next();
}

async function handleRecognize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // validateRequest 미들웨어가 이미 검증·치환한 값이므로 안전하게 단언한다.
    const { grade } = req.body as RecognizeRequestDto;
    const imageBuffer = req.file?.buffer;

    if (!imageBuffer) {
      next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
      return;
    }

    const recognized = await resolveAdapter().recognizeProblem(imageBuffer, grade);

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
}

recognitionRouter.post(
  "/problems/recognize",
  authenticate,
  rateLimiter,
  uploadProblemImage,
  requireImageFile,
  validateRequest(recognizeRequestSchema),
  handleRecognize,
);
