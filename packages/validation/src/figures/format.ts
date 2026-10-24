/**
 * 도형 수치 라벨 포맷 — `docs/FIGURE_SPEC.md` §12.
 *
 * AI가 만든 수치 문자열을 받지 않고(§1 원칙 5), 렌더러가 계산한 길이·각도를 이 함수로만 표시한다.
 * - 허용오차 안에서 정수에 가까우면 정수로 맞춘다(예: 44.97° → 45°, 길이 2.9995 → 3).
 * - 그 밖에는 소수 둘째 자리에서 반올림하고 끝의 0을 지운다(예: 2.50 → 2.5, 1.414 → 1.41).
 * - 각도에는 °를 붙인다.
 * - 비유한수는 빈 문자열.
 */
import { ANGLE_TOL_DEG, LENGTH_REL_TOL } from "./tolerance";

export interface FormatFigureNumberOptions {
  /** "angle"이면 각도(° 표시, 허용오차 `ANGLE_TOL_DEG`). 기본 "length". */
  unit?: "length" | "angle";
  /**
   * 정수로 맞출 허용오차를 직접 지정한다. 지정하지 않으면 각도는 `ANGLE_TOL_DEG`,
   * 길이는 `LENGTH_REL_TOL × max(1, |값|)`.
   */
  tolerance?: number;
}

export function formatFigureNumber(value: number, options: FormatFigureNumberOptions = {}): string {
  if (!Number.isFinite(value)) return "";
  const unit = options.unit ?? "length";
  const tolerance =
    options.tolerance ?? (unit === "angle" ? ANGLE_TOL_DEG : LENGTH_REL_TOL * Math.max(1, Math.abs(value)));

  const nearestInteger = Math.round(value);
  const snapped = Math.abs(value - nearestInteger) <= tolerance ? nearestInteger : value;
  const rounded = Math.round(snapped * 100) / 100;
  let text = rounded.toFixed(2).replace(/\.?0+$/, "");
  if (text === "-0" || text === "") text = "0";
  return unit === "angle" ? `${text}°` : text;
}
