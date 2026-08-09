import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
// authenticate는 반드시 mock된 @supabase/supabase-js를 통해서만 동작해야 하며,
// 실제 네트워크 호출이 발생해서는 안 된다.
import { authenticate } from "./authenticate";

const getUserMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

function createMockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function createMockReq(headers: Record<string, string> = {}): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe("authenticate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("Authorization 헤더가 없으면 401을 응답하고 next를 호출하지 않는다", async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "unauthorized", message: expect.any(String) },
    });
    expect(next).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("Supabase가 유저를 찾지 못하면 401을 응답한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });

    const req = createMockReq({ authorization: "Bearer invalid-token" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(getUserMock).toHaveBeenCalledWith("invalid-token");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("유효한 토큰이면 req.user를 채우고 next를 호출한다", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { grade: "M2" } } },
      error: null,
    });

    const req = createMockReq({ authorization: "Bearer valid-token" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("grade가 유효하지 않은 값이면 undefined로 처리하고 next를 호출한다", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", user_metadata: { grade: "not-a-grade" } } },
      error: null,
    });

    const req = createMockReq({ authorization: "Bearer valid-token" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
