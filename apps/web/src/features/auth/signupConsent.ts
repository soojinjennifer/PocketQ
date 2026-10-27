import type { User } from "@supabase/supabase-js";
import { hasSignupConsentMetadata } from "validation";

/**
 * 가입 동의 정책 버전(D3). 약관·방침 개정 시 올린다. 게이트는 버전을 비교하지 않는다(D4) —
 * 재동의가 필요해지면 그때 비교 로직을 추가한다.
 */
export const CONSENT_POLICY_VERSION = "2026-10-29";

export interface SignupConsentMetadata {
  age14_confirmed_at: string;
  terms_agreed_at: string;
  privacy_agreed_at: string;
  consent_policy_version: string;
}

/** 체크리스트 3항목의 선택 상태. 화면(게이트·회원가입)이 공유한다. */
export interface ConsentState {
  age14: boolean;
  terms: boolean;
  privacy: boolean;
}

export const EMPTY_CONSENT_STATE: ConsentState = { age14: false, terms: false, privacy: false };

/** 세 항목이 모두 선택되었는지. 전체 동의 체크박스는 두지 않는다(D10). */
export function isConsentComplete(state: ConsentState): boolean {
  return state.age14 && state.terms && state.privacy;
}

/** PRD AUTH-11 — 세 동의 일시 키가 모두 비어 있지 않은 문자열이면 동의 완료로 본다(서버와 같은 규칙). */
export function hasSignupConsent(user: User | null): boolean {
  return hasSignupConsentMetadata(user?.user_metadata);
}

/** 제출 1회분의 동의 메타데이터. 세 일시는 같은 ISO 시각을 공유한다(D3). */
export function buildSignupConsentMetadata(now: Date = new Date()): SignupConsentMetadata {
  const timestamp = now.toISOString();
  return {
    age14_confirmed_at: timestamp,
    terms_agreed_at: timestamp,
    privacy_agreed_at: timestamp,
    consent_policy_version: CONSENT_POLICY_VERSION,
  };
}
