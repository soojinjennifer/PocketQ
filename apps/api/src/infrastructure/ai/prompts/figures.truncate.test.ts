/**
 * Stage 4 L-7(S4-L7) — priorWork 300자 자르기에서 고아 서러게이트 0.
 */
import { describe, expect, it } from "vitest";
import type { Diagnosis } from "shared-types";
import { buildPriorWork, MAX_PRIOR_WORK_LINE_LENGTH, truncateUtf16 } from "./figures";

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

const DIAG = { lastValidLine: 5, stallLine: null } as Pick<Diagnosis, "lastValidLine" | "stallLine"> as Diagnosis;

describe("S4-L7 서러게이트 안전 자르기", () => {
  it("모든 경계 위치(쌍의 앞·뒤·BMP)에서 300자 자르기 결과에 고아 서러게이트가 없다", () => {
    for (let pad = 0; pad < 4; pad += 1) {
      const text = "x".repeat(pad) + "𝑥😀".repeat(200);
      const lines = buildPriorWork("own", [{ lineNo: 1, latex: text, isLowConfidence: false }], DIAG)?.lines ?? [];
      const line = lines[0] ?? "";
      expect(hasLoneSurrogate(line)).toBe(false);
      expect(line.length).toBeLessThanOrEqual(MAX_PRIOR_WORK_LINE_LENGTH);
      expect(line.length).toBeGreaterThanOrEqual(MAX_PRIOR_WORK_LINE_LENGTH - 1);
      expect(text.startsWith(line)).toBe(true);
    }
  });

  it("경계가 쌍 가운데면 한 글자를 빼고, 아니면 기존 slice와 같다", () => {
    expect(truncateUtf16("ab😀", 3)).toBe("ab");
    expect(truncateUtf16("a😀b", 3)).toBe("a😀");
    expect(truncateUtf16("abcd", 3)).toBe("abc");
    expect(truncateUtf16("ab", 3)).toBe("ab");
    const ascii = "a".repeat(400);
    expect(truncateUtf16(ascii, 300)).toBe(ascii.slice(0, 300));
  });
});
