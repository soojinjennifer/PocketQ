/**
 * 마이페이지 오버레이 불투명화(2026-10-25 오너 결정, 장부 §8.16) — `HistoryDetailPanel` 루트 배경 토큰
 * `bg-glass-fill`(#fbfaf6f5) → `bg-bg-canvas`(#fbfaf6, 같은 RGB의 불투명 토큰) 한 개만 바뀐 것을
 * **변경 전 DOM 기준값**(`pages/mypage/__baseline__/myPageDetailDom.baseline.json`)에 적용한다.
 *
 * `stage5OneLineDelta.ts`와 같은 방식이다: 기준값 파일은 고치지 않고, 비교 직전에 기준값 HTML의 대상 노드에만
 * 승인된 토큰 증감을 적용한다. 그 밖의 태그·속성·텍스트·class 토큰은 여전히 같아야 한다.
 *
 * 대상 노드: `role="dialog"`·`aria-label="지난 풀이 다시 보기"`이고 class에 `bg-glass-fill`이 있는 요소.
 * **정확히 1개**여야 한다 — 기준값이 바뀌어 대상이 없거나 여럿이면 조용히 넘어가지 않고 예외를 던진다.
 */
const TARGET_SELECTOR = '[role="dialog"][aria-label="지난 풀이 다시 보기"]';
const DELTA = { remove: ["bg-glass-fill"], add: ["bg-bg-canvas"] } as const;

export function applyHistoryPanelOpaqueDelta(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const targets = [...template.content.querySelectorAll(TARGET_SELECTOR)].filter((element) =>
    element.classList.contains("bg-glass-fill"),
  );
  if (targets.length !== 1) {
    throw new Error(`historyPanelOpaqueDelta: 대상 노드가 정확히 1개가 아니다(${targets.length}개)`);
  }
  const [target] = targets;
  if (target) {
    for (const token of DELTA.remove) target.classList.remove(token);
    for (const token of DELTA.add) target.classList.add(token);
  }
  return template.innerHTML;
}
