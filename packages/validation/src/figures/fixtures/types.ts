/**
 * 도형 명세 fixture 공통 타입.
 *
 * - `raw`는 의도적으로 `unknown`이다. 잘못된 입력 fixture를 타입 시스템이 미리 막지 않도록
 *   (그리고 테스트가 실제 런타임 검증만으로 판정하도록) 원시 객체로 둔다.
 * - `expect.stage1`: Stage 1 구조 스키마(`figureSpecSchema`) 판정.
 * - `expect.stage2`: Stage 2 의미 검증기(참조·의존 순서·수학적 모순)의 기대 판정.
 * - `expected`: Stage 2 기대값. 좌표·각도·불연속 위치는 **검증 커널을 호출하지 않고 손으로 독립
 *   계산한 리터럴**이다(커널이 틀리면 테스트가 잡도록). `stage2Issue`는 의미 검증기가 반드시
 *   보고해야 하는 오류(code + path).
 * - 이 디렉터리는 `validation` 메인 index에서 export하지 않는다(테스트 전용).
 */
export type FixtureVerdict = "accept" | "reject";

export interface FigureFixtureExpectedIssue {
  /** zod issue 경로(도형 명세 루트 기준). */
  path: (string | number)[];
  /** zod issue code(예: "custom", "too_big", "unrecognized_keys", "invalid_type"). */
  code: string;
}

/** Stage 2 의미 검증 기대 오류. */
export interface FigureFixtureStage2Issue {
  /** `FigureSemanticIssueCode`(예: "unknown_reference", "constraint_violation"). */
  code: string;
  /** 도형 명세 루트 기준 경로. */
  path: (string | number)[];
}

export interface FigureFixtureExpected {
  /** 계산된 점 좌표(독립 계산). */
  points?: { id: string; x: number; y: number }[];
  /** 각의 크기(도, 독립 계산). */
  angles?: { id: string; degrees: number }[];
  /** 함수 그래프 불연속 x 위치(독립 계산). 그래프 조각이 이 x를 가로지르면 안 된다. */
  discontinuities?: { graph: string; x: number }[];
  /** stage2가 reject인 fixture에서 반드시 포함돼야 하는 의미 오류. */
  stage2Issue?: FigureFixtureStage2Issue;
}

export interface FigureFixture {
  id: string;
  title: string;
  raw: unknown;
  expect: { stage1: FixtureVerdict; stage2: FixtureVerdict };
  /** stage1이 reject인 fixture에서 반드시 포함돼야 하는 issue. */
  stage1Issue?: FigureFixtureExpectedIssue;
  /** Stage 2 기대값. */
  expected?: FigureFixtureExpected;
}

export interface LegacyFixture {
  id: string;
  title: string;
  raw: unknown;
}
