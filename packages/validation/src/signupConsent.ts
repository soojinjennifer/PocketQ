/**
 * 가입 동의 판정 규칙(PRD AUTH-11). 웹 게이트(`features/auth/signupConsent.ts`)와 서버
 * (`DELETE /api/account/unconsented`)가 같은 규칙을 쓰도록 여기 하나만 둔다.
 */

/** 동의 일시를 담는 `user_metadata` 키(snake_case). 세 키가 모두 있어야 동의 완료다. */
export const SIGNUP_CONSENT_TIMESTAMP_KEYS = [
  "age14_confirmed_at",
  "terms_agreed_at",
  "privacy_agreed_at",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 세 동의 일시 키가 모두 비어 있지 않은 문자열이면 동의 완료로 본다. 정책 버전
 * (`consent_policy_version`)은 판정에 쓰지 않는다(D4) — 버전만 있는 메타데이터는 미동의다.
 */
export function hasSignupConsentMetadata(metadata: unknown): boolean {
  if (!isRecord(metadata)) {
    return false;
  }
  return SIGNUP_CONSENT_TIMESTAMP_KEYS.every((key) => {
    const value = metadata[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}
