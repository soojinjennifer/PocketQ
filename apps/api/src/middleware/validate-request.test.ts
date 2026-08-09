import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { validateRequest } from "./validate-request";

function createMockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("validateRequest", () => {
  const schema = z.object({ name: z.string() });

  it("유효한 body는 파싱된 값으로 치환하고 next를 호출한다", () => {
    const req = { body: { name: "whymath" } } as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateRequest(schema)(req, res, next);

    expect(req.body).toEqual({ name: "whymath" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("유효하지 않은 body는 400 validation_error를 응답하고 next를 호출하지 않는다", () => {
    const req = { body: { name: 123 } } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateRequest(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "validation_error" }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
