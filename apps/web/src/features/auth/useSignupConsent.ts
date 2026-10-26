import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { deleteUnconsentedAccount } from "../../shared/api/deleteUnconsentedAccount";
import { supabase } from "../../shared/lib/supabase/client";
import {
  buildSignupConsentMetadata,
  EMPTY_CONSENT_STATE,
  hasSignupConsent,
  isConsentComplete,
  type ConsentState,
} from "./signupConsent";

export const CONSENT_SAVE_FAILED_MESSAGE = "동의 내용을 저장하지 못했어요. 다시 시도해 주세요";
export const ACCOUNT_DELETE_FAILED_MESSAGE = "계정 정보를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요";
export const ALREADY_CONSENTED_MESSAGE = "이미 동의가 완료된 계정이에요";

interface UseSignupConsentOptions {
  /**
   * 저장 응답(`updateUser`의 `data.user`)으로 동의가 확인되면 호출한다(R5). `USER_UPDATED` 이벤트가
   * 늦게 오더라도 게이트가 원래 화면으로 넘어가게 하기 위한 경로다.
   */
  onConsented: (userId: string) => void;
}

/**
 * 가입 동의 게이트 로직(PRD AUTH-11).
 * - `submit`: 세 항목을 모두 고르면 `user_metadata`에 동의 기록 4개 키를 저장한다.
 * - `leaveAsUnderAge`: 미동의 계정을 서버에서 지우고, 로컬 세션을 정리한 뒤 `/login`으로 이동한다.
 *   진행 중 재호출은 무시한다. 실패하면 팝업을 닫고 오류를 표시한다(포커스 복귀는 화면 책임).
 */
export function useSignupConsent({ onConsented }: UseSignupConsentOptions) {
  const navigate = useNavigate();
  const [consent, setConsent] = useState<ConsentState>(EMPTY_CONSENT_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnderAgeModalOpen, setIsUnderAgeModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 상태 갱신은 다음 렌더에야 보이므로, 같은 틱의 연속 클릭을 막는 가드는 ref로 둔다.
  const deleteInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);

  const isComplete = isConsentComplete(consent);
  const isBusy = isSubmitting || isDeleting;

  const submit = useCallback(async () => {
    if (!isConsentComplete(consent) || submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);
    const { data, error } = await supabase.auth.updateUser({ data: buildSignupConsentMetadata() });
    submitInFlightRef.current = false;
    setIsSubmitting(false);
    if (error) {
      setErrorMessage(CONSENT_SAVE_FAILED_MESSAGE);
      return;
    }
    if (hasSignupConsent(data.user)) {
      onConsented(data.user.id);
      return;
    }
    // 저장은 성공했다고 응답했지만 동의 키가 보이지 않는다. 재시도를 안내한다.
    setErrorMessage(CONSENT_SAVE_FAILED_MESSAGE);
  }, [consent, onConsented]);

  const openUnderAgeModal = useCallback(() => {
    setErrorMessage(null);
    setIsUnderAgeModalOpen(true);
  }, []);

  const closeUnderAgeModal = useCallback(() => {
    if (deleteInFlightRef.current) {
      return;
    }
    setIsUnderAgeModalOpen(false);
  }, []);

  const leaveAsUnderAge = useCallback(async () => {
    if (deleteInFlightRef.current) {
      return;
    }
    deleteInFlightRef.current = true;
    setIsDeleting(true);
    try {
      const result = await deleteUnconsentedAccount();
      if (result === "already-consented") {
        deleteInFlightRef.current = false;
        setIsDeleting(false);
        setIsUnderAgeModalOpen(false);
        setErrorMessage(ALREADY_CONSENTED_MESSAGE);
        return;
      }
    } catch {
      deleteInFlightRef.current = false;
      setIsDeleting(false);
      setIsUnderAgeModalOpen(false);
      setErrorMessage(ACCOUNT_DELETE_FAILED_MESSAGE);
      return;
    }
    // 계정은 이미 지워졌다. `scope: "local"`은 다른 기기의 세션은 건드리지 않고 이 기기의 세션을 정리한다.
    // supabase-js는 이때도 `POST /logout?scope=local`을 보낸다. 404·401·403은 오류로 보지 않고, 그 밖의 오류여도
    // 로컬 세션은 지운다(auth-js `_signOut`). 그래서 삭제된 계정의 토큰이라 서버가 거부해도 이 기기는 로그아웃된다.
    await supabase.auth.signOut({ scope: "local" });
    void navigate("/login", { replace: true });
  }, [navigate]);

  return {
    consent,
    setConsent,
    isComplete,
    isSubmitting,
    isDeleting,
    isBusy,
    errorMessage,
    submit,
    isUnderAgeModalOpen,
    openUnderAgeModal,
    closeUnderAgeModal,
    leaveAsUnderAge,
  };
}
