import { useEffect, useState, type RefObject } from "react";

/** 화면 세로 가운데 선만 남긴 root. 요소가 이 선을 지나면 교차로 본다. */
export const VIEWPORT_CENTER_ROOT_MARGIN = "-50% 0px -50% 0px";
export const VISIBILITY_THRESHOLDS = [0, 0.25, 0.9];
/** 이 비율 이상 보이면 가운데 선에 닿지 않아도 재생한다(페이지 맨 아래 영상은 가운데까지 올라오지 못한다). */
const PLAY_RATIO = 0.9;
/** 이 비율 미만으로 줄면 일시정지한다. 두 값 사이에서는 직전 상태를 유지한다(히스테리시스). */
const PAUSE_RATIO = 0.25;

export interface ViewportPlayback {
  shouldPlay: boolean;
  shouldPause: boolean;
}

/**
 * 요소의 화면 위치로 재생·일시정지 신호를 낸다(D2-1). IntersectionObserver가 없거나 `enabled`가 false면
 * 두 신호 모두 false다(관찰자를 만들지 않는다).
 */
export function useViewportPlayback(
  ref: RefObject<Element | null>,
  enabled: boolean,
): ViewportPlayback {
  const [centerHit, setCenterHit] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const target = ref.current;
    if (!enabled || !target || typeof IntersectionObserver !== "function") {
      return undefined;
    }
    const centerObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setCenterHit(entry.isIntersecting);
      },
      { rootMargin: VIEWPORT_CENTER_ROOT_MARGIN, threshold: 0 },
    );
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setRatio(entry.isIntersecting ? entry.intersectionRatio : 0);
      },
      { threshold: VISIBILITY_THRESHOLDS },
    );
    centerObserver.observe(target);
    visibilityObserver.observe(target);
    return () => {
      centerObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [ref, enabled]);

  if (!enabled) {
    return { shouldPlay: false, shouldPause: false };
  }
  const shouldPlay = centerHit || (ratio !== null && ratio >= PLAY_RATIO);
  const shouldPause = !shouldPlay && ratio !== null && ratio < PAUSE_RATIO;
  return { shouldPlay, shouldPause };
}
