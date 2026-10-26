import { useState } from "react";
import ctaLogoUrl from "../../assets/landing/cta-logo-720.webp";
import { LandingButton } from "./LandingButton";
import { LANDING_BODY_L, LANDING_CONTAINER, LANDING_SCROLL_MARGIN } from "./landingStyles";

export type LandingOAuthProvider = "kakao" | "google";

interface CtaSectionProps {
  /**
   * 소셜 로그인 시작. 랜딩 feature는 다른 feature(auth)를 직접 참조하지 않으므로 페이지가 주입한다(frontend.md §1).
   * 성공하면 브라우저가 Provider로 이동하고, 실패하면 `error` 메시지를 돌려준다.
   */
  onStartOAuth: (provider: LandingOAuthProvider) => Promise<{ error: string | null }>;
}

/** 기기 안내 문구(오너 결정 4) — 폰·세로 화면 사용자에게 가로 화면 요구를 미리 알린다. */
export const LANDING_DEVICE_NOTICE = "iPad 가로 화면에 최적화되어 있어요";

/**
 * CTA · 시작하기(`447:131`). 카드 p 64 / radius 36 / `brand/tint` / Shadow Raised, 1024 이상 2열(gap 32).
 * 진행 중에는 두 버튼을 `disabled` + `aria-busy`로 막는다(기존 로그인 화면 패턴, §7.1).
 */
export function CtaSection({ onStartOAuth }: CtaSectionProps) {
  const [pendingProvider, setPendingProvider] = useState<LandingOAuthProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStart = async (provider: LandingOAuthProvider) => {
    setErrorMessage(null);
    setPendingProvider(provider);
    const result = await onStartOAuth(provider);
    setPendingProvider(null);
    if (result.error) {
      setErrorMessage(result.error);
    }
  };

  const isBusy = pendingProvider !== null;

  return (
    <section id="start" aria-labelledby="start-title" className={LANDING_SCROLL_MARGIN}>
      <div className={`${LANDING_CONTAINER} pt-6 pb-14 lg:pb-[88px]`}>
        <div className="bg-landing-brand-tint border-landing-border-edge rounded-landing-cta shadow-landing-raised flex flex-col gap-8 border p-6 md:p-10 lg:flex-row lg:items-center lg:p-16">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-1">
            <h2
              id="start-title"
              className="text-landing-brand-deep m-0 text-3xl leading-[1.15] font-extrabold tracking-[-1.2px] md:text-4xl lg:text-5xl"
            >
              오늘 막힌 문제,
              <br />
              지금 바로 풀어봐요.
            </h2>
            <p className={`text-landing-brand-deep m-0 ${LANDING_BODY_L}`}>
              PC에서, 혹은 iPad, 갤럭시 탭에서 열고, 홈 화면에 추가하면 앱처럼 써요.
              <br />
              이메일·닉네임·학년과 동의 기록만 받아요.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <LandingButton
                as="button"
                variant="kakao-m"
                disabled={isBusy}
                aria-busy={pendingProvider === "kakao"}
                onClick={() => void handleStart("kakao")}
              >
                카카오로 시작하기
              </LandingButton>
              <LandingButton
                as="button"
                variant="secondary-m"
                disabled={isBusy}
                aria-busy={pendingProvider === "google"}
                onClick={() => void handleStart("google")}
              >
                Google로 시작하기
              </LandingButton>
            </div>
            <p className="text-landing-label-ink m-0 text-sm">{LANDING_DEVICE_NOTICE}</p>
            {errorMessage ? (
              <p role="alert" className="text-landing-brand-deep m-0 text-sm font-semibold">
                {errorMessage}
              </p>
            ) : null}
          </div>
          <div className="bg-landing-brand-tint rounded-landing-media mx-auto flex aspect-[484/360] w-full max-w-[484px] items-center justify-center overflow-hidden lg:mx-0 lg:flex-1">
            <img
              src={ctaLogoUrl}
              alt="수풀잉"
              width={720}
              height={720}
              loading="lazy"
              decoding="async"
              className="aspect-square h-full max-w-full object-contain opacity-80"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
