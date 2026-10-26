import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { buildSignupConsentMetadata } from "../features/auth/signupConsent";

export type AuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void | Promise<void>;

/**
 * 가입 동의를 마친 사용자의 동의 기록(PRD AUTH-11). `createFakeSession`이 기본으로 `user_metadata`에 합친다 —
 * 그래야 기존 테스트의 보호 화면이 가입 동의 게이트에 막히지 않는다(R1).
 */
export const CONSENTED_METADATA = buildSignupConsentMetadata(new Date("2026-10-26T00:00:00.000Z"));

function buildSession(user: User): Session {
  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
}

function buildUser(overrides: Partial<User>, userMetadata: User["user_metadata"]): User {
  return {
    id: "test-user-id",
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "student@example.com",
    ...overrides,
    user_metadata: userMetadata,
  };
}

/**
 * 테스트용 가짜 Supabase 세션/사용자를 만든다. 가입 동의를 마친 사용자다 — `overrides.user_metadata`는
 * `CONSENTED_METADATA` 위에 합쳐진다(같은 키를 넘기면 그 값이 이긴다).
 */
export function createFakeSession(overrides: Partial<User> = {}): Session {
  return buildSession(buildUser(overrides, { ...CONSENTED_METADATA, ...overrides.user_metadata }));
}

/** 가입 동의 기록이 없는 사용자(가입 동의 게이트 테스트용). `overrides.user_metadata`는 그대로 쓴다. */
export function createUnconsentedSession(overrides: Partial<User> = {}): Session {
  return buildSession(buildUser(overrides, { ...overrides.user_metadata }));
}
