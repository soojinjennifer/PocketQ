import multer, { MulterError } from "multer";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors/AppError";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new AppError("validation_error", "이미지 파일은 jpeg/png/webp 형식만 허용됩니다.", 400));
      return;
    }
    callback(null, true);
  },
});

const uploadSingleImage = upload.single("image");

/**
 * multer의 콜백 스타일 에러를 AppError 기반 next(err) 흐름으로 통일한다.
 * MIME 타입 위반, 5MB 초과 모두 400 validation_error로 응답한다.
 */
export function uploadProblemImage(req: Request, res: Response, next: NextFunction): void {
  uploadSingleImage(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err instanceof MulterError) {
      next(new AppError("validation_error", `이미지 업로드에 실패했습니다: ${err.message}`, 400));
      return;
    }
    next(err);
  });
}
