import { isForbiddenLabelCodePoint } from "validation";

/**
 * 렌더러 쪽 라벨 2차 방어 — 스키마(`isSafeLabelText`)가 이미 거부하는 문자를 한 번 더 지운다.
 * 목록은 validation의 `isForbiddenLabelCodePoint`(양방향 제어·제로폭·BOM·줄/문단 구분자·보이지 않는
 * 결합·서식 문자·변형 선택자·태그 문자·한글 채움 문자)를 그대로 쓰고, 제어문자(C0·DEL·C1)를 더한다.
 * 라벨은 SVG 텍스트 노드로만 출력하므로 HTML 이스케이프는 하지 않는다(`display: "internal"`).
 */
function isStrippedCodePoint(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || isForbiddenLabelCodePoint(code);
}

export function sanitizeLabelText(value: string): string {
  let result = "";
  for (const char of value) {
    if (!isStrippedCodePoint(char.codePointAt(0) ?? 0)) result += char;
  }
  return result;
}
