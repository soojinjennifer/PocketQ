import { useEffect, useState } from "react";
import { supabase } from "../../shared/lib/supabase/client";
import { Spinner } from "../../shared/ui/spinner/Spinner";
import { LandingPage } from "../../pages/landing/LandingPage";

type SessionCheck = "checking" | "anonymous";

/** 세션 확인을 기다리는 최대 시간. 넘으면 랜딩을 먼저 보여 준다(getSession이 멈춰도 Spinner에 갇히지 않게). */
export const SESSION_CHECK_TIMEOUT_MS = 3000;

/** 타이머 주입용(테스트). 반환값은 취소 함수. */
export type ScheduleTimeout = (callback: () => void, ms: number) => () => void;

function defaultScheduleTimeout(callback: () => void, ms: number): () => void {
  const id = window.setTimeout(callback, ms);
  return () => window.clearTimeout(id);
}

interface LandingAppProps {
  /** 로그인 상태일 때 서비스로 보내는 함수. 기본은 기록을 남기지 않는 `location.replace`(테스트에서 주입). */
  redirectToService?: (path: string) => void;
  /** 세션 확인 제한 시간 타이머(테스트에서 주입). */
  scheduleTimeout?: ScheduleTimeout;
}

function replaceLocation(path: string): void {
  window.location.replace(path);
}

/**
 * 랜딩(`/home.html`) 루트. 세션을 먼저 확인해 로그인한 사용자는 서비스 루트(`/`)로 보내고(랜딩이 깜빡이지 않게
 * 확인하는 동안 Spinner만 보인다), 세션이 없거나 확인에 실패하면 랜딩을 그린다. ViewportGuard는 쓰지 않는다.
 *
 * `getSession`이 `SESSION_CHECK_TIMEOUT_MS` 안에 끝나지 않으면 랜딩을 먼저 그린다. 그 뒤에 늦게 세션이 확인돼도
 * 서비스로 보낸다 — 로그인한 사용자가 시작 버튼을 다시 누르게 하는 것보다 잠깐 보인 랜딩에서 이동하는 편이 낫다.
 */
export function LandingApp({
  redirectToService = replaceLocation,
  scheduleTimeout = defaultScheduleTimeout,
}: LandingAppProps) {
  const [state, setState] = useState<SessionCheck>("checking");

  useEffect(() => {
    let isActive = true;
    const cancelTimeout = scheduleTimeout(() => {
      if (isActive) setState("anonymous");
    }, SESSION_CHECK_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isActive) return;
        cancelTimeout();
        if (!error && data.session) {
          redirectToService("/");
          return;
        }
        setState("anonymous");
      })
      .catch(() => {
        if (!isActive) return;
        cancelTimeout();
        setState("anonymous");
      });
    return () => {
      isActive = false;
      cancelTimeout();
    };
  }, [redirectToService, scheduleTimeout]);

  if (state === "checking") {
    return (
      <div className="bg-landing-bg-page flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return <LandingPage />;
}
