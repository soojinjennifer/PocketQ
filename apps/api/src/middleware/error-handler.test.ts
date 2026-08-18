import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors/AppError";
import { errorHandler } from "./error-handler";

function createMockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AppError는 그 code/status/message를 그대로 응답한다", () => {
    const res = createMockRes();

    errorHandler(
      new AppError("validation_error", "문제를 찾을 수 없습니다.", 404),
      {} as Request,
      res,
      vi.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "validation_error", message: "문제를 찾을 수 없습니다." },
    });
  });

  it("AppError가 아닌 에러는 원본 메시지를 노출하지 않고 일반 메시지로 500을 응답한다(Final QA MEDIUM-1)", () => {
    const res = createMockRes();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    errorHandler(
      new Error("connection reset by peer: password=hunter2"),
      {} as Request,
      res,
      vi.fn() as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "internal_error", message: "예상치 못한 오류가 발생했습니다." },
    });
    const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as unknown;
    expect(JSON.stringify(jsonCall)).not.toContain("hunter2");
  });

  it("원본 에러는 서버 로그(console.error)에는 남긴다", () => {
    const res = createMockRes();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalError = new Error("secret internal detail");

    errorHandler(originalError, {} as Request, res, vi.fn() as NextFunction);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("errorHandler"), originalError);
  });
});
