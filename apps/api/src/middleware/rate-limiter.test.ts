import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../config/env", () => ({
  env: { rateLimitMax: 2, rateLimitWindowMs: 60_000 },
}));

const { rateLimiter } = await import("./rate-limiter");

function createMockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function createMockReq(ip: string): Request {
  return { ip } as Request;
}

describe("rateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("limit 이하 요청은 통과시킨다", () => {
    const ip = `127.0.0.${Math.random()}`;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    rateLimiter(createMockReq(ip), res, next);
    rateLimiter(createMockReq(ip), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("limit을 초과하면 429 rate_limited를 응답한다", () => {
    const ip = `127.0.0.${Math.random()}`;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    rateLimiter(createMockReq(ip), res, next);
    rateLimiter(createMockReq(ip), res, next);
    rateLimiter(createMockReq(ip), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "rate_limited" }) }),
    );
  });
});
