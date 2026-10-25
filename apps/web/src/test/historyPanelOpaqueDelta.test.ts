/**
 * `historyPanelOpaqueDelta`가 승인된 토큰 하나(`bg-glass-fill` → `bg-bg-canvas`)만 바꾸고, 기준값 비교가 그 밖의 변이를
 * 여전히 걸러내는지 확인한다(기준값 JSON은 덮어쓰지 않는다 — 장부 §8.16).
 */
import { describe, expect, it } from "vitest";
import baselineJson from "../pages/mypage/__baseline__/myPageDetailDom.baseline.json";
import { applyHistoryPanelOpaqueDelta } from "./historyPanelOpaqueDelta";
import { applyStage5OneLineDelta, sortClassTokens } from "./stage5OneLineDelta";

const baseline = baselineJson as { html: Record<string, string> };
const KEYS = Object.keys(baseline.html);

function classTokensByNode(html: string): string[][] {
  const template = document.createElement("template");
  template.innerHTML = html;
  return [...template.content.querySelectorAll("*")].map((node) => [...node.classList].sort());
}

describe("historyPanelOpaqueDelta", () => {
  it("기준값 4종이 모두 있다", () => {
    expect(KEYS.sort()).toEqual(["noSolution", "withFigures", "withSolutionAndChat", "withSolutionNoChat"]);
  });

  it.each(KEYS)("%s: 루트 한 노드의 bg-glass-fill → bg-bg-canvas만 바뀐다", (key) => {
    const before = baseline.html[key] ?? "";
    const after = applyHistoryPanelOpaqueDelta(before);
    const beforeNodes = classTokensByNode(before);
    const afterNodes = classTokensByNode(after);

    expect(afterNodes).toHaveLength(beforeNodes.length);
    const changed = beforeNodes.flatMap((tokens, index) =>
      tokens.join(" ") === (afterNodes[index] ?? []).join(" ") ? [] : [index],
    );
    expect(changed).toEqual([0]);
    expect(beforeNodes[0]).toContain("bg-glass-fill");
    expect(afterNodes[0]).not.toContain("bg-glass-fill");
    expect(afterNodes[0]).toContain("bg-bg-canvas");
    expect(afterNodes[0]?.filter((token) => token !== "bg-bg-canvas")).toEqual(
      beforeNodes[0]?.filter((token) => token !== "bg-glass-fill"),
    );
    // 클래스 외(태그·속성·텍스트)는 그대로다.
    expect(sortClassTokens(after.replace("bg-bg-canvas", "bg-glass-fill"))).toBe(sortClassTokens(before));
  });

  it("대상 노드가 없거나 여럿이면 예외를 던진다(조용히 넘어가지 않는다)", () => {
    expect(() => applyHistoryPanelOpaqueDelta("<div></div>")).toThrow();
    const root = baseline.html["noSolution"] ?? "";
    expect(() => applyHistoryPanelOpaqueDelta(applyHistoryPanelOpaqueDelta(root))).toThrow();
    expect(() => applyHistoryPanelOpaqueDelta(root + root)).toThrow();
  });

  describe("승인되지 않은 변이는 여전히 비교에서 걸러진다", () => {
    const expected = applyHistoryPanelOpaqueDelta(applyStage5OneLineDelta(baseline.html["withSolutionAndChat"] ?? ""));
    const MUTATIONS: Record<string, (html: string) => string> = {
      "배경 토큰을 되돌림": (html) => html.replace("bg-bg-canvas", "bg-glass-fill"),
      "두 토큰을 모두 둠": (html) => html.replace("bg-bg-canvas", "bg-bg-canvas bg-glass-fill"),
      "다른 불투명 토큰(bg-bg-elevated)": (html) => html.replace("bg-bg-canvas", "bg-bg-elevated"),
      "보더 토큰 변경": (html) => html.replace("border-glass-border", "border-modal-border"),
      "모서리 변경": (html) => html.replace("rounded-[24px]", "rounded-[28px]"),
      "그림자 제거": (html) => html.replace(/ shadow-\[[^\]]+\]/, ""),
      "안쪽 카드 배경 변경": (html) => html.replace("bg-bg-elevated", "bg-bg-canvas"),
      "aria-label 변경": (html) => html.replace('aria-label="지난 풀이 다시 보기"', 'aria-label="지난 풀이"'),
      "속성 추가": (html) => html.replace('role="dialog"', 'role="dialog" data-qa="x"'),
      "텍스트 변경": (html) => html.replace("목록으로", "목록"),
    };

    it.each(Object.keys(MUTATIONS))("%s", (name) => {
      const mutate = MUTATIONS[name];
      if (!mutate) throw new Error(name);
      const mutated = mutate(expected);
      expect(mutated).not.toBe(expected);
      expect(sortClassTokens(mutated)).not.toBe(sortClassTokens(expected));
    });
  });
});
