import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/**
 * zod 스키마로 req.body를 검증하고, 검증된(파싱된) 값으로 req.body를 교체한다.
 * 실패 시 400 + validation_error를 응답한다.
 */
export function validateRequest<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: {
          code: "validation_error",
          message: "요청 형식이 올바르지 않습니다.",
          details: result.error.issues,
        },
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
