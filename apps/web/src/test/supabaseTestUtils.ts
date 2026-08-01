import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

export type AuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void | Promise<void>;

/** 테스트용 가짜 Supabase 세션/사용자를 만든다. */
export function createFakeSession(overrides: Partial<User> = {}): Session {
  const user: User = {
    id: "test-user-id",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "student@example.com",
    ...overrides,
  };

  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
}
