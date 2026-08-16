import type { ReactNode } from "react";
import { ResultPanelResizeHandle, type ResultPanelWidth } from "./ResultPanelResizeHandle";
import { useKeyboardInset } from "./useKeyboardInset";

export type { ResultPanelWidth };

interface ResultPanelShellProps {
  children: ReactNode;
  /** 패널 폭 상태(Figma `Width=Default`/`Width=Extend`/`Width=Close`). 기본값 `"default"`. */
  width?: ResultPanelWidth;
  /** 좌측 `ResultPanelResizeHandle`의 상태 전환 콜백. 핸들은 폭 상태와 무관하게 항상 렌더링된다. */
  onExtend: () => void;
  onBackToDefault: () => void;
  onClose: () => void;
  onOpen: () => void;
}

/**
 * `/solve/landscape` 우측 Result Panel 영역의 위치/크기/유리 패널 스타일 셸. 로딩 중(raw
 * 스트리밍 텍스트/Spinner)과 완료 후(`ResultPanel`) 콘텐츠가 이 셸 안에서 전환되며, 항상 같은
 * DOM 요소를 유지한다(오너 iPad 실사용 중 발견: 로딩 박스와 완료 후 Result Panel이 서로 다른
 * 위치·스타일에 각각 마운트되어 "다른 곳에서 갑자기 나타나는" 것처럼 보이던 문제 수정,
 * 2026-08-14). Figma(`38:21`/`39:28`)에는 애초에 "Result Panel이 없는 상태"가 정의돼 있지
 * 않다 — ProblemCard/ActionBar/Result Panel이 한 프레임에 항상 함께 배치돼 있으므로, 로딩
 * 단계부터 이 셸을 정식 Result Panel과 동일한 위치·폭·스타일로 노출한다.
 *
 * 위치(top-3/right-3, 하단은 `bottom-[calc(0.75rem+env(safe-area-inset-bottom))]`로 iPad
 * safe-area까지 반영, 키보드가 열리면 `useKeyboardInset()`만큼 인라인 스타일로 추가 — 아래
 * 참고)·폭(`w-[min(420px,45vw)]`, Figma 420px + 좁은 Split View 방어용 45vw 상한)·배경/
 * 보더(`bg-glass-fill`/`border-glass-border`, Figma `glass/fill`, `glass/border`)·모서리
 * (`rounded-[24px]`, Figma 실측값)·그림자(Figma `Elevation/Glass Panel` 재실측값)는 기존
 * `ResultPanel`이 갖고 있던 값을 그대로 옮겼다(이중 래핑 방지를 위해 `ResultPanel`에서는 제거).
 *
 * iPad 온스크린 키보드 대응(오너 6.5단계 완료 조건 보완 요청, 2026-08-16): iOS Safari는 키보드가
 * 열려도 레이아웃 뷰포트(`100vh`/`min-h-screen` 기준)가 줄지 않아, 이 셸의 `bottom` 오프셋이
 * 그대로면 후속 질문 입력창이 키보드 뒤에 가려진다. `useKeyboardInset()`(`window.visualViewport`
 * 기반, 미지원 환경에서는 항상 0)가 가려진 높이(px)를 반환하면 그만큼 `bottom`에 더해 패널
 * 전체를 위로 당긴다 — 내부 Header/Body/Footer 재분배는 `ResultPanel`의 기존 flex 레이아웃이
 * 그대로 처리하므로 이 컴포넌트는 위치만 책임진다.
 *
 * 슬라이드 인 모션(`result-panel-slide-in`, `shared/styles/global.css`)은 이 셸이 처음
 * 마운트되는 순간에만 자동 재생된다 — 로딩 중 콘텐츠가 갱신되거나 로딩→성공으로 바뀌어도
 * (같은 DOM 요소 유지) 다시 재생되지 않고, "새 문제"/재시도로 셸 자체가 사라졌다가 다시
 * 나타날 때만 재생된다.
 *
 * `z-20`(ProblemCard/ActionBar 래퍼의 `z-10`보다 높음): design-agent가 Figma(`38:21`,
 * fileKey `ltyPrCk8UT8DsB3tFuw7Sr`)를 재실측한 결과 Default 상태에서도 Action Bar 우측 끝이
 * Result Panel 좌측 끝과 10px 겹치는 것으로 나타나(오너 명시 확인, 2026-08-14), ProblemCard/
 * ActionBar가 우측 공간을 예약해 겹침을 피하는 대신 이 셸이 더 높은 z-index로 위에 얹혀 필요하면
 * 겹치는 방식으로 변경했다(`SolveLandscapePage` 참고).
 *
 * `width` 3상태(Figma 컴포넌트 갤러리 `174:639` 근방, design-agent 실측, 2026-08-14):
 * - `"default"`(기본값): `w-[min(420px,45vw)]`(위 실측값 그대로).
 * - `"extend"`: `w-[min(748px,90vw)]` — 748px는 Figma 실측값, `90vw` 상한은 Figma 근거 없는
 *   좁은 화면 방어용 임시값(결정 필요).
 * - `"close"`: `w-6`(24px, 좌측 `ResultPanelResizeHandle`과 동일 폭) — 헤더/바디/푸터
 *   `children`은 렌더링하지 않고 `aria-hidden` 처리한다.
 * 폭 전환에는 `transition-[width] duration-300 ease-out`을 적용한다(300ms는 기존 슬라이드 인
 * 모션과 맞춘 임시값, Figma 근거 없음 — 결정 필요). 좌측 `ResultPanelResizeHandle`(24×88px)은
 * 셸의 `absolute` 위치 지정을 컨테이닝 블록으로 삼아 `-left-6`에 고정 배치되며, 3가지 폭
 * 상태에서 항상 같은 크기·위치를 유지한다. 핸들이 셸 바깥으로 튀어나와야 하므로(음수 `left`),
 * `overflow-hidden`/모서리 반경/그림자/배경은 바깥 위치 컨테이너가 아니라 안쪽 콘텐츠
 * 래퍼(`inset-0`)에만 적용한다 — 바깥 컨테이너에 `overflow-hidden`을 두면 핸들이 잘려 보인다.
 */
export function ResultPanelShell({
  children,
  width = "default",
  onExtend,
  onBackToDefault,
  onClose,
  onOpen,
}: ResultPanelShellProps) {
  const widthClassName =
    width === "extend" ? "w-[min(748px,90vw)]" : width === "close" ? "w-6" : "w-[min(420px,45vw)]";

  // iPad 온스크린 키보드가 이 셸의 `bottom` 기준 위치(포함된 `ResultPanel` Footer/후속 질문
  // 입력창)를 가리는 문제 보완(위 JSDoc, `useKeyboardInset` 참고). 키보드가 닫혀 있으면 0이라
  // 인라인 스타일을 아예 적용하지 않고, 기존 `bottom-[...]` 클래스 값을 그대로 쓴다(회귀 없음).
  const keyboardInset = useKeyboardInset();

  return (
    <div
      className={`pointer-events-auto absolute top-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 ${widthClassName} transition-[width,bottom] duration-300 ease-out`}
      style={
        keyboardInset > 0
          ? { bottom: `calc(0.75rem + env(safe-area-inset-bottom) + ${keyboardInset}px)` }
          : undefined
      }
    >
      <ResultPanelResizeHandle
        width={width}
        onExtend={onExtend}
        onBackToDefault={onBackToDefault}
        onClose={onClose}
        onOpen={onOpen}
      />
      <div className="bg-glass-fill border-glass-border absolute inset-0 flex flex-col overflow-hidden rounded-[24px] border shadow-[0px_4px_0px_rgba(35,43,56,0.21),0px_13px_24px_rgba(35,43,56,0.18),0px_25px_45px_rgba(35,43,56,0.1),inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)] animate-[result-panel-slide-in_300ms_ease-out]">
        {/* Close 상태에서는 콘텐츠를 아예 렌더링하지 않는다(스크린리더에도 노출되지 않음) —
            핸들만 보이는 상태이므로 헤더/바디/푸터를 유지할 이유가 없다. */}
        {width === "close" ? null : children}
      </div>
    </div>
  );
}
