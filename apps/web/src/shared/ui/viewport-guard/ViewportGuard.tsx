import { useEffect, useState, type ReactNode } from "react";

/** Figma 기준 1194px 폭 화면을 정상 지원하는 최소 CSS px 너비. window.innerWidth 기준(screen.width 사용 금지). */
const MIN_SUPPORTED_WIDTH = 1024;

interface ViewportState {
  isPortrait: boolean;
  isTooNarrow: boolean;
}

function readViewportState(): ViewportState {
  return {
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
      ? { isPortrait: false, isTooNarrow: false }
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

  const notice = viewport.isPortrait
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
          className="bg-bg-camera-sheet fixed inset-0 z-50 flex items-center justify-center px-6 text-center"
        >
          <p className="text-label-on-dark text-xl font-semibold">{notice}</p>
        </div>
      ) : null}
    </>
  );
}
