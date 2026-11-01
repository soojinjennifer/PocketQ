import { useEffect, useState, type ReactNode } from "react";

/** Figma 기준 1194px 폭 화면을 정상 지원하는 최소 CSS px 너비. window.innerWidth 기준(screen.width 사용 금지). */
const MIN_SUPPORTED_WIDTH = 1024;

/**
 * 기기 화면의 짧은 변이 이 값(CSS px)보다 작으면 휴대폰으로 본다. 휴대폰은 430 안팎, 가장 작은 iPad(mini)는 744다.
 * 창 크기(innerWidth)가 아니라 `screen`을 보는 이유: iPad Split View·PC 작은 창은 창만 좁을 뿐 휴대폰이 아니다.
 */
const PHONE_MAX_SHORT_SIDE = 600;

/** 휴대폰에서는 회전·전체 화면으로 해결되지 않으므로 지원 기기를 안내한다. */
export const PHONE_NOTICE = "iPad, 갤럭시 패드, PC에서 접속하시면 바로 보실 수 있습니다.";

interface ViewportState {
  isPhone: boolean;
  isPortrait: boolean;
  isTooNarrow: boolean;
}

function readViewportState(): ViewportState {
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return {
    // 화면 크기를 알 수 없으면(0) 휴대폰으로 단정하지 않는다.
    isPhone: shortSide > 0 && shortSide < PHONE_MAX_SHORT_SIDE,
    isPortrait: window.innerHeight > window.innerWidth,
    isTooNarrow: window.innerWidth < MIN_SUPPORTED_WIDTH,
  };
}

interface ViewportGuardProps {
  children: ReactNode;
}

/**
 * iPad 가로 전체화면(1024px 이상)만 정상 지원한다는 것을 안내하는 leaf 컴포넌트.
 * 인증 상태를 알지 못하며 URL을 변경하지 않는다 — 항상 children을 렌더링하고
 * 필요 시 그 위에 조건부 오버레이만 표시한다.
 */
export function ViewportGuard({ children }: ViewportGuardProps) {
  const [viewport, setViewport] = useState<ViewportState>(() =>
    typeof window === "undefined"
      ? { isPhone: false, isPortrait: false, isTooNarrow: false }
      : readViewportState(),
  );

  useEffect(() => {
    const handleChange = () => setViewport(readViewportState());
    handleChange();
    window.addEventListener("resize", handleChange);
    window.addEventListener("orientationchange", handleChange);
    return () => {
      window.removeEventListener("resize", handleChange);
      window.removeEventListener("orientationchange", handleChange);
    };
  }, []);

  const notice = viewport.isPhone
    ? PHONE_NOTICE
    : viewport.isPortrait
      ? "기기를 가로로 돌려주세요"
      : viewport.isTooNarrow
        ? "전체 화면에서 이용해 주세요"
        : null;

  return (
    <>
      {children}
      {notice !== null ? (
        <div
          role="alert"
          data-testid="viewport-guard-overlay"
          className="bg-bg-camera-sheet fixed top-0 left-0 z-50 h-dvh w-full flex items-center justify-center px-6 text-center"
        >
          <p className="text-label-on-dark text-xl font-semibold text-balance break-keep">{notice}</p>
        </div>
      ) : null}
    </>
  );
}
