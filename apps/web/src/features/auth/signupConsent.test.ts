import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  buildSignupConsentMetadata,
  CONSENT_POLICY_VERSION,
  hasSignupConsent,
  isConsentComplete,
} from "./signupConsent";

function userWith(metadata: Record<string, unknown>): User {
  return { user_metadata: metadata } as User;
}

describe("signupConsent", () => {
  it("buildSignupConsentMetadata는 세 일시를 같은 ISO 시각으로, 정책 버전과 함께 만든다", () => {
    const now = new Date("2026-10-26T01:02:03.000Z");

    expect(buildSignupConsentMetadata(now)).toEqual({
      age14_confirmed_at: "2026-10-26T01:02:03.000Z",
      terms_agreed_at: "2026-10-26T01:02:03.000Z",
      privacy_agreed_at: "2026-10-26T01:02:03.000Z",
      consent_policy_version: CONSENT_POLICY_VERSION,
    });
    expect(CONSENT_POLICY_VERSION).toBe("2026-10-26");
  });

  it("hasSignupConsent는 세 키가 모두 비어 있지 않은 문자열일 때만 true다", () => {
    const full = buildSignupConsentMetadata(new Date("2026-10-26T00:00:00.000Z"));

    expect(hasSignupConsent(userWith({ ...full }))).toBe(true);
    expect(hasSignupConsent(null)).toBe(false);
    expect(hasSignupConsent(userWith({}))).toBe(false);
    expect(hasSignupConsent(userWith({ ...full, terms_agreed_at: undefined }))).toBe(false);
    expect(hasSignupConsent(userWith({ ...full, privacy_agreed_at: "  " }))).toBe(false);
    expect(hasSignupConsent(userWith({ ...full, age14_confirmed_at: 123 }))).toBe(false);
    expect(hasSignupConsent(userWith({ ...full, terms_agreed_at: "" }))).toBe(false);
    // 정책 버전만 있는 메타데이터는 미동의다(서버 409 판정과 같은 규칙, validation `hasSignupConsentMetadata`).
    expect(hasSignupConsent(userWith({ consent_policy_version: full.consent_policy_version }))).toBe(false);
  });

  it("hasSignupConsent는 정책 버전을 비교하지 않는다(D4)", () => {
    const full = buildSignupConsentMetadata();

    expect(hasSignupConsent(userWith({ ...full, consent_policy_version: "1999-01-01" }))).toBe(true);
    expect(
      hasSignupConsent(
        userWith({
          age14_confirmed_at: full.age14_confirmed_at,
          terms_agreed_at: full.terms_agreed_at,
          privacy_agreed_at: full.privacy_agreed_at,
        }),
      ),
    ).toBe(true);
  });

  it("isConsentComplete는 세 항목이 모두 선택되어야 true다", () => {
    expect(isConsentComplete({ age14: true, terms: true, privacy: true })).toBe(true);
    expect(isConsentComplete({ age14: true, terms: true, privacy: false })).toBe(false);
    expect(isConsentComplete({ age14: false, terms: false, privacy: false })).toBe(false);
  });
});
