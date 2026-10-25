import type { ReactNode } from "react";

/**
 * 도형 슬롯 고정 래퍼(Stage 4 재작업 1, design P2-1, `docs/FIGURE_DESIGN.md` §17.7).
 *
 * - `aria-live="off"` 래퍼가 그림과 **함께 새로 삽입되면** 일부 스크린리더는 새 노드의 live 설정을 무시하고 조상(Body의
 *   `aria-live="polite"`) 규칙으로 읽는다. 그래서 래퍼는 슬롯 위치에 미리 렌더해 두고, 내용(지연 로딩되는 그림)만 채운다.
 * - 래퍼는 실제 상자로 둔다(`display:contents`는 Safari 접근성 트리에서 빠지는 문제가 있어 쓰지 않음). 대신 보이는
 *   자식이 없으면(`hidden` 자식뿐이거나 비어 있음) 부모 `gap-3`을 `-mt-3`으로 상쇄해 간격이 새지 않는다.
 * - 플래그 off 화면·MyPage처럼 `figureContent`를 넘기지 않는 곳에서는 렌더하지 않는다(기존 DOM 동일).
 */
export function FigureSlot({ children }: { children: ReactNode }) {
  return (
    <div aria-live="off" data-figure-slot="" className="[&:not(:has(>:not([hidden])))]:-mt-3">
      {children}
    </div>
  );
}
