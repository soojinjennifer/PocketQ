/**
 * (재작업 1: 버튼 정렬 여백은 링 바깥 `mt-0.5` — design P3.)
 * Stage 5 승인 클래스 변경(S5-V7·V8·V10, `docs/FIGURE_DESIGN.md` §18.12·§18.13)을 **변경 전 DOM 기준값**에 그대로 적용한다.
 *
 * `RecognizedProblemBar`에 한 줄 배치·포커스 링 클래스가 추가되어(오너 승인) 변경 전에 캡처한 DOM 기준값과 그 노드의 class만 달라진다.
 * 기준값 파일은 고치지 않고, 비교 직전에 기준값 HTML의 해당 노드에만 승인된 토큰 증감을 적용한다 — 그 밖의 태그·속성·텍스트·
 * class 토큰은 여전히 문자 단위로 같아야 한다(다른 차이가 생기면 비교가 실패한다).
 *
 * 대상 노드: 첫 자식이 텍스트 "인식됨" `span`이고 자식이 [span, p, button]인 `div`(RecognizedProblemBar 카드).
 */
const DELTA = {
  card: { remove: ["items-center"], add: ["items-start"] },
  badge: { remove: [], add: ["shrink-0", "whitespace-nowrap"] },
  text: { remove: [], add: ["min-w-0", "pt-0.5", "wrap-anywhere"] },
  button: {
    remove: [],
    add: [
      "focus-visible:ring-brand",
      "rounded-[6px]",
      "mt-0.5",
      "whitespace-nowrap",
      "outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-offset-2",
    ],
  },
} as const;

function apply(element: Element, delta: { remove: readonly string[]; add: readonly string[] }): void {
  for (const token of delta.remove) element.classList.remove(token);
  for (const token of delta.add) element.classList.add(token);
}

export function applyStage5OneLineDelta(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const card of template.content.querySelectorAll("div")) {
    const [badge, text, button] = [...card.children];
    if (
      card.children.length === 3 &&
      badge?.tagName === "SPAN" &&
      badge.textContent === "인식됨" &&
      text?.tagName === "P" &&
      button?.tagName === "BUTTON"
    ) {
      apply(card, DELTA.card);
      apply(badge, DELTA.badge);
      apply(text, DELTA.text);
      apply(button, DELTA.button);
    }
  }
  return template.innerHTML;
}

/** 모든 요소의 class 토큰을 정렬한 HTML(토큰 집합이 같으면 같은 문자열). */
export function sortClassTokens(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const node of template.content.querySelectorAll("[class]")) {
    node.setAttribute("class", [...node.classList].sort().join(" "));
  }
  return template.innerHTML;
}
