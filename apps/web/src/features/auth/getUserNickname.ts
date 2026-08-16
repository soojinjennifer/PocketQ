import type { User } from "@supabase/supabase-js";

/**
 * Supabase `user_metadata.nickname`을 안전하게 좁힌다(문자열이 아니거나 공백뿐이면 `null`).
 * 가입 시 `useAuthActions.signUpWithEmail`이 `options.data.nickname`으로 저장하는 값이라
 * 소셜 로그인 사용자에게는 없을 수 있다(`getUserGrade`와 동일한 방어 패턴).
 */
export function getUserNickname(user: User | null): string | null {
  const value: unknown = user?.user_metadata?.["nickname"];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
