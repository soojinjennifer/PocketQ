import { describe, expect, it } from "vitest";
import { LAYER, SAFE_TEXT_ATTRIBUTES } from "./applySceneToBoard";

describe("레이어 순서(재작업 1: P1-1)", () => {
  it("직각 표시·각 호가 점 언더레이보다 위, 점·라벨은 그 위", () => {
    expect(LAYER.pointUnderlay).toBeLessThan(LAYER.angle);
    expect(LAYER.underlay).toBeLessThan(LAYER.angle);
    expect(LAYER.angle).toBeLessThan(LAYER.point);
    expect(LAYER.point).toBeLessThan(LAYER.text);
  });

  it("텍스트 안전 속성", () => {
    expect(SAFE_TEXT_ATTRIBUTES).toEqual({ display: "internal", parse: false, useMathJax: false, useKatex: false, useASCIIMathML: false });
  });
});
