import { useEffect, useState } from "react";

/**
 * iPad Safari에서 온스크린 키보드가 열려도 레이아웃 뷰포트(`window.innerHeight`, 따라서 CSS
 * `vh`/`100dvh` 기준 높이)는 줄어들지 않고, 오직 시각 뷰포트(`window.visualViewport`)만 줄어드는
 * WebKit 동작 때문에 생기는 문제를 보완하기 위한 훅이다.
 *
 * `SolveLandscapePage`(`pages/solve/landscape`)는 모든 자식을 `absolute`로 배치하고
 * `h-dvh`(100dvh)로 루트 높이를 정하는 레이아웃이라, `ResultPanelShell`이 그 루트 기준
 * `bottom-*`으로 하단을 고정해도 키보드가 열리면 루트 높이 자체가 줄지 않아 하단 콘텐츠(후속 질문
 * 입력창)가 키보드 뒤로 가려진다. 이 훅은 그 가려진 높이(px)를 반환해서 `ResultPanelShell`이 자신의
 * `bottom` 오프셋에 더할 수 있게 한다 — 패널 전체 높이가 그만큼 줄어들며 위로 당겨지고, 내부
 * Header/Body/Footer는 기존 flex 레이아웃(`ResultPanel`)이 알아서 재분배한다(이 훅 자체는 레이아웃을
 * 모른다).
 *
 * `visualViewport`를 지원하지 않는 환경에서는 항상 0을 반환한다(기존 동작 그대로, 회귀 없음).
 * 지속적인 polling 없이 `resize`/`scroll` 이벤트에만 반응하며, unmount 시 리스너를 정리한다.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateInset = () => {
      // 레이아웃 뷰포트 하단에서 시각 뷰포트가 가려진 높이. 키보드가 없으면 0(또는 그 이하)에
      // 수렴하므로 음수는 0으로 clamp한다.
      const overlap = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(Math.max(0, Math.round(overlap)));
    };

    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
    };
  }, []);

  return inset;
}
