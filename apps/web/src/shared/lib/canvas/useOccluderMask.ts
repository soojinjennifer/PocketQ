import { useEffect, type RefObject } from "react";

/**
 * 필기 캔버스 위에 떠 있는 UI(NavTabs, InputModeToggle, ActionBar, PenRail 그룹 등)에 이 속성을
 * 붙이면, `useOccluderMask`가 그 영역만큼 캔버스 잉크를 가린다(오너 실기기 보고, 2026-10: 스크롤하면
 * 필기가 반투명 버튼 위로 겹쳐 보였다). 속성 자체는 아무 동작도 하지 않는 표식이다.
 */
export const CANVAS_OCCLUDER_PROPS = { "data-canvas-occluder": "" } as const;
const CANVAS_OCCLUDER_SELECTOR = "[data-canvas-occluder]";

interface HoleRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/** 표식 wrapper 자체엔 모서리가 없고 실제 pill/카드는 첫 자식이라, 첫 자식의 모서리 반경을 쓴다. */
function readCornerRadius(element: Element, width: number, height: number): number {
  const visual = element.firstElementChild ?? element;
  const radius = Number.parseFloat(getComputedStyle(visual).borderTopLeftRadius) || 0;
  return Math.min(radius, width / 2, height / 2);
}

function buildMaskImage(width: number, height: number, holes: HoleRect[]): string {
  const holeMarkup = holes
    .map(
      (hole) =>
        `<rect x='${hole.x}' y='${hole.y}' width='${hole.width}' height='${hole.height}' rx='${hole.radius}' fill='black'/>`,
    )
    .join("");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>` +
    `<defs><mask id='m'><rect width='100%' height='100%' fill='white'/>${holeMarkup}</mask></defs>` +
    `<rect width='100%' height='100%' fill='black' mask='url(#m)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function applyMask(element: HTMLElement, maskImage: string | null) {
  const declarations: [string, string][] = [
    ["mask-image", maskImage ?? ""],
    ["-webkit-mask-image", maskImage ?? ""],
    ["mask-size", maskImage ? "100% 100%" : ""],
    ["-webkit-mask-size", maskImage ? "100% 100%" : ""],
    ["mask-repeat", maskImage ? "no-repeat" : ""],
    ["-webkit-mask-repeat", maskImage ? "no-repeat" : ""],
  ];
  for (const [property, value] of declarations) {
    if (value) {
      element.style.setProperty(property, value);
    } else {
      element.style.removeProperty(property);
    }
  }
}

/**
 * `targetRef` 요소(캔버스 뷰포트)의 부모 안에서 `CANVAS_OCCLUDER_PROPS`가 붙은 요소들의 영역을
 * CSS mask로 뚫어, 그 영역에서는 캔버스 잉크가 보이지 않게 한다. 페이지 배경 텍스처는 캔버스가
 * 아니라 페이지 루트에 있으므로 그대로 보인다.
 *
 * mask는 스크롤 컨테이너의 박스 기준으로 적용되므로, 필기를 스크롤해도 버튼 영역은 계속 가려진다.
 * React state를 거치지 않고 DOM style을 직접 갱신한다 — 필기 중 리렌더를 만들지 않기 위해서다.
 * 표식 요소의 크기 변화(ResizeObserver)와 마운트/언마운트(MutationObserver)를 감지해 rAF 1회로
 * 묶어 다시 계산한다. 필기 자체는 DOM을 바꾸지 않으므로 획을 그리는 동안에는 재계산되지 않는다.
 */
export function useOccluderMask(targetRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const target = targetRef.current;
    const root = target?.parentElement;
    if (!enabled || !target || !root) {
      return;
    }

    let rafId = 0;
    const observed = new Set<Element>();

    const update = () => {
      rafId = 0;
      const targetRect = target.getBoundingClientRect();
      const occluders = Array.from(root.querySelectorAll(CANVAS_OCCLUDER_SELECTOR));

      for (const element of observed) {
        if (!occluders.includes(element)) {
          resizeObserver.unobserve(element);
          observed.delete(element);
        }
      }

      const holes: HoleRect[] = [];
      for (const element of occluders) {
        if (!observed.has(element)) {
          resizeObserver.observe(element);
          observed.add(element);
        }
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          continue;
        }
        holes.push({
          x: rect.left - targetRect.left,
          y: rect.top - targetRect.top,
          width: rect.width,
          height: rect.height,
          radius: readCornerRadius(element, rect.width, rect.height),
        });
      }

      const hasArea = targetRect.width > 0 && targetRect.height > 0;
      applyMask(
        target,
        hasArea && holes.length > 0 ? buildMaskImage(targetRect.width, targetRect.height, holes) : null,
      );
    };

    const schedule = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(update);
      }
    };

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(target);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, { childList: true, subtree: true });
    schedule();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      applyMask(target, null);
    };
  }, [targetRef, enabled]);
}
