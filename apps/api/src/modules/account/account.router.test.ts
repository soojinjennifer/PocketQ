import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// 실제 Supabase에 연결하지 않는다. 토큰 검증(getUser)과 관리자 API(getUserById/deleteUser)를 모두 mock으로 대체한다.
// supertest 서버는 전역 setup(`test-support/loopbackListen.ts`)이 127.0.0.1에 묶는다.
const { getUserMock, getUserByIdMock, deleteUserMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  deleteUserMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      admin: { getUserById: getUserByIdMock, deleteUser: deleteUserMock },
    },
  })),
}));

const { createApp } = await import("../../app");
const { env } = await import("../../config/env");
const { FakeLLMAdapter } = await import("../../infrastructure/ai/fake-adapter");

const AUTH_HEADER = { Authorization: "Bearer valid-token" };
const CONSENTED_METADATA = {
  nickname: "새싹",
  age14_confirmed_at: "2026-10-26T00:00:00.000Z",
  terms_agreed_at: "2026-10-26T00:00:00.000Z",
  privacy_agreed_at: "2026-10-26T00:00:00.000Z",
  consent_policy_version: "2026-10-26",
};

function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

function storedUser(userMetadata: Record<string, unknown>, id = "user-1") {
  return { data: { user: { id, user_metadata: userMetadata } }, error: null };
}

const VICTIM_ID = "victim-user";

describe("DELETE /api/account/unconsented", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserByIdMock.mockReset();
    deleteUserMock.mockReset();
    getUserMock.mockResolvedValue(storedUser({}));
    deleteUserMock.mockResolvedValue({ data: { user: null }, error: null });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증 헤더가 없으면 401이고 아무것도 조회·삭제하지 않는다", async () => {
    const res = await request(createTestApp()).delete("/api/account/unconsented");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(getUserByIdMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("동의 기록이 없는 계정은 서버에서 다시 읽은 뒤 deleteUser를 호출하고 204로 응답한다", async () => {
    getUserByIdMock.mockResolvedValue(storedUser({ nickname: "새싹" }));

    const res = await request(createTestApp()).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(getUserByIdMock).toHaveBeenCalledWith("user-1");
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
  });

  it("동의 기록이 모두 있는 계정은 409이고 deleteUser를 호출하지 않는다", async () => {
    getUserByIdMock.mockResolvedValue(storedUser(CONSENTED_METADATA));

    const res = await request(createTestApp()).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("conflict");
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  // 웹 게이트(`hasSignupConsent`)와 같은 규칙(validation `hasSignupConsentMetadata`)이다. 게이트가 보이는 사용자는
  // 항상 삭제할 수 있어야 하므로, 세 일시가 모두 비어 있지 않은 문자열이 아니면 미동의로 보고 지운다.
  it.each([
    ["동의 일시 키 하나만", { terms_agreed_at: "2026-10-26T00:00:00.000Z" }],
    ["정책 버전만", { consent_policy_version: "2026-10-26" }],
    ["한 키가 빈 문자열", { ...CONSENTED_METADATA, privacy_agreed_at: "" }],
    ["한 키가 공백뿐", { ...CONSENTED_METADATA, age14_confirmed_at: "   " }],
    ["한 키가 문자열이 아님", { ...CONSENTED_METADATA, terms_agreed_at: 20261026 }],
  ])("동의가 완전하지 않은 계정(%s)은 웹 게이트와 같이 미동의로 보고 삭제한다(204)", async (_label, metadata) => {
    getUserByIdMock.mockResolvedValue(storedUser(metadata));

    const res = await request(createTestApp()).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(res.status).toBe(204);
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
  });

  it("409 응답은 conflict 코드와 고정 메시지를 쓴다", async () => {
    getUserByIdMock.mockResolvedValue(storedUser(CONSENTED_METADATA));

    const res = await request(createTestApp()).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "conflict", message: "이미 가입 동의가 기록된 계정입니다." } });
  });

  describe("사용자 id는 토큰에서만 온다(IDOR 방지)", () => {
    function attackRequest() {
      return request(createTestApp())
        .delete(`/api/account/unconsented?userId=${VICTIM_ID}&id=${VICTIM_ID}&user_id=${VICTIM_ID}`)
        .set(AUTH_HEADER)
        .set("x-user-id", VICTIM_ID)
        .set("user-id", VICTIM_ID)
        .send({ userId: VICTIM_ID, id: VICTIM_ID, user_id: VICTIM_ID });
    }

    it("미동의 토큰 사용자가 헤더·쿼리·본문에 다른 id를 실어도 조회·삭제는 토큰 사용자 id로만 한다", async () => {
      getUserByIdMock.mockImplementation((id: string) => Promise.resolve(storedUser({}, id)));

      const res = await attackRequest();

      expect(res.status).toBe(204);
      expect(getUserByIdMock.mock.calls).toEqual([["user-1"]]);
      expect(deleteUserMock.mock.calls).toEqual([["user-1"]]);
    });

    it("동의 토큰 사용자가 미동의 피해자 id를 실어 보내도 자기 계정 기준 409이고 아무것도 지우지 않는다", async () => {
      getUserByIdMock.mockImplementation((id: string) =>
        Promise.resolve(id === "user-1" ? storedUser(CONSENTED_METADATA, id) : storedUser({}, id)),
      );

      const res = await attackRequest();

      expect(res.status).toBe(409);
      expect(getUserByIdMock.mock.calls).toEqual([["user-1"]]);
      expect(deleteUserMock).not.toHaveBeenCalled();
    });
  });

  it("같은 사용자가 속도 제한을 넘기면 429이고 더는 조회·삭제하지 않는다", async () => {
    // 속도 제한 창은 모듈 전역이라 다른 테스트와 겹치지 않는 전용 사용자를 쓴다.
    getUserMock.mockResolvedValue(storedUser({}, "rate-limit-user"));
    getUserByIdMock.mockResolvedValue(storedUser(CONSENTED_METADATA, "rate-limit-user"));
    const app = createTestApp();

    for (let index = 0; index < env.rateLimitMax; index += 1) {
      const allowed = await request(app).delete("/api/account/unconsented").set(AUTH_HEADER);
      expect(allowed.status).toBe(409);
    }
    getUserByIdMock.mockClear();

    const limited = await request(app).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limited");
    expect(getUserByIdMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("토큰 검증 시점의 메타데이터가 아니라 서버에서 다시 읽은 메타데이터로 판단한다", async () => {
    // 토큰(getUser)에는 동의 기록이 없지만, 다른 탭에서 방금 동의해 저장소에는 기록이 있는 경우.
    getUserMock.mockResolvedValue(storedUser({}));
    getUserByIdMock.mockResolvedValue(storedUser(CONSENTED_METADATA));

    const res = await request(createTestApp()).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(res.status).toBe(409);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("사용자 재조회가 실패하면 500이고 삭제하지 않으며 원본 오류를 노출하지 않는다", async () => {
    getUserByIdMock.mockResolvedValue({ data: { user: null }, error: { message: "secret detail" } });

    const res = await request(createTestApp()).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    expect(JSON.stringify(res.body)).not.toContain("secret detail");
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("deleteUser가 실패하면 500으로 응답한다", async () => {
    getUserByIdMock.mockResolvedValue(storedUser({}));
    deleteUserMock.mockResolvedValue({ data: { user: null }, error: { message: "db down" } });

    const res = await request(createTestApp()).delete("/api/account/unconsented").set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    expect(JSON.stringify(res.body)).not.toContain("db down");
  });
});
