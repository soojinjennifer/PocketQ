/**
 * shared-types
 *
 * API 스키마와 무관한 Provider 독립적 도메인 타입만 정의한다.
 * 런타임 의존성이 전혀 없는 순수 타입 선언 전용 패키지다 (zod 등 금지).
 */

/** 학생 학년: 중1~중3, 고1~고3 */
export type Grade = "M1" | "M2" | "M3" | "H1" | "H2" | "H3";

/** 풀이 요청 시 선택 옵션 (개념 설명 / 풀이 각각 켜고 끌 수 있다) */
export interface SolveOptions {
  concept: boolean;
  solution: boolean;
}

/** 풀이 생성에 사용하는 AI 제공자 */
export type AiProvider = "openai" | "claude";

/** 이미지에서 인식된 문제 원문/LaTeX */
export interface RecognizedProblem {
  recognizedText: string;
  recognizedLatex: string | null;
}

/** AI가 생성한 개념 설명·풀이·답 결과 */
export interface Solution {
  conceptMd: string | null;
  solutionMd: string | null;
  answerMd: string;
  conceptTags: string[];
  aiProvider: AiProvider;
  aiModel: string;
  /**
   * 도형 시각화(PRD §4.12 FIG, `docs/FIGURE_SPEC.md`). 선택 필드 — 기존 응답·저장 데이터에는 없다.
   * 서버 검증을 통과한 명세만 담긴다(Stage 3부터 채워짐, Stage 1은 타입만 추가).
   */
  figures?: FigureSpec[];
  /** 풀이 단계(stepId) ↔ 도형(figureId) 연결. `figures`와 함께 선택 필드다. */
  stepFigureRefs?: StepFigureRef[];
}

/** 후속 질문(채팅) 메시지의 발화자 */
export type ChatRole = "user" | "assistant";

/** 후속 질문(채팅) 대화 이력의 개별 메시지 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** API 전역에서 사용하는 에러 코드 */
export type ErrorCode =
  | "validation_error"
  | "unauthorized"
  | "recognition_failed"
  | "not_math_problem"
  | "provider_error"
  | "timeout"
  | "rate_limited"
  | "internal_error";

/** 이미지에서 줄 단위로 인식된 학생 풀이(WORK-2, 진단 전 인식 결과). */
export interface WorkLine {
  /** 1-base 줄 번호. */
  lineNo: number;
  /** 줄 단위로 인식된 LaTeX. */
  latex: string;
  /** 인식 신뢰도가 낮아 학생 확인/수정이 필요한 줄이면 true. */
  isLowConfidence: boolean;
}

/** CAS(Computer Algebra System)가 판정한 줄 단위 정답 검증 결과. */
export interface CasStepVerification {
  lineNo: number;
  isValid: boolean;
}

/** 관련 개념 하나에 대한 제목+설명(DIAG "#개념설명" 토글 카드용). */
export interface ConceptExplanation {
  /** `Diagnosis.relatedConcepts`의 항목 이름과 매칭된다. */
  name: string;
  /** 개념 제목(예: "이차함수의 표준형과 꼭짓점"). */
  title: string;
  /** 개념 정의/핵심 원리 설명(마크다운). */
  explanationMd: string;
}

/** 학생 풀이 진단 결과(DIAG). */
export interface Diagnosis {
  /** 마지막으로 유효했던 줄 번호(1-base). 첫 줄부터 막혔으면 0. */
  lastValidLine: number;
  /** 최초로 부적합했던 줄 번호(DIAG-2 "막힌 지점"). 오류 없이 중단된 경우(DIAG-4 "중단형")면 `null`. */
  stallLine: number | null;
  /** `error_taxonomy.name`(DIAG-3). 오류가 없으면 `null`. */
  errorTypeLabel: string | null;
  /** 오류 상세 설명(DIAG-2). */
  errorDetail: string | null;
  /** 막힌 지점과 연결된 개념(DIAG-2 "관련 개념"). */
  relatedConcepts: string[];
  /** 정답에 도달했지만 표기·논리 비약이 있는 경우(DIAG-6). */
  reachedAnswerWithNotes: boolean;
  /** 진단 신뢰도가 임계값 미만이면 단정하지 않고 완화 표현으로 전환한다(DIAG-5). */
  isLowConfidence: boolean;
  /** `relatedConcepts` 각 항목에 대한 제목+설명("#개념설명" 해시태그 토글 카드용). */
  conceptExplanations: ConceptExplanation[];
  /**
   * 학생이 사용 중인(또는 사용하려던) 해법을 LLM이 식별한 결과(RESUME 단계가 이어풀기를 같은
   * 해법으로 진행하기 위한 근거). `method_catalog` 테이블이 아직 없어 LLM이 구조화 JSON으로
   * 직접 이름을 생성한다 — 식별할 수 없으면 `null`.
   */
  identifiedMethod: { methodId: string; methodName: string } | null;
  /**
   * RESUME-4: 식별된 해법이 이 문제에 실제로 적용 가능한지 여부. `false`면 "내 방법으로 계속"을
   * 비활성화해야 한다(`ResumeModeBar.ownModeDisabled`).
   */
  isMethodApplicable: boolean;
  /** `isMethodApplicable`이 `false`일 때만 그 이유를 채운다. 적용 가능하면 `null`. */
  methodApplicabilityNote: string | null;
  /**
   * 원 문제의 정답을 구조화된 LaTeX로 담은 값(RESUME-5 CAS 최종 답 검증의 기준값).
   * `identifiedMethod`와 동일한 방식으로 `diagnose()` 호출 시 LLM이 문제 텍스트로부터 직접
   * 생성한다(별도 `method_catalog`/정답 테이블과의 DB 조인 없음).
   */
  problemAnswerLatex: string;
}

/** 이어풀기(RESUME) 요청 모드 — "내 방법으로 계속" 또는 "다른 방법으로"(PRD §4.7). */
export type ResumeMode = "own" | "alternative";

/**
 * `POST /api/problems/:problemId/resume` 요청 바디. 문제/진단 데이터는 서버가 저장소에서
 * problemId로 다시 조회하므로 클라이언트가 중복해서 보내지 않는다.
 */
export interface ResumeRequest {
  problemId: string;
  mode: ResumeMode;
}

/** 이어풀기(RESUME) 생성 결과 — `ResumeResultCard`(features/ai-solution)가 그대로 렌더링하는 모양. */
export interface ResumeSolution {
  mode: ResumeMode;
  /**
   * 2026-09 design-agent Figma 실측(`255:92`) 이후 의미 재정의: 원래는 "식별/제안된 해법명"이었으나,
   * `ResumeResultCard`의 15px Semibold 헤드라인 행은 Figma 예시상 **"이어가는 지점 요약"**
   * (예: "3번째 줄부터 이어가기")을 보여준다. 필드명은 백엔드(프롬프트/파서/테스트, 1차 구현·검증
   * 완료분)를 다시 건드리는 리스크를 피하기 위해 `methodName`을 그대로 유지하기로 했다(2차 화면
   * 연결 작업 오너 판단). `buildResumePrompt`(`prompts/system.ts`)와 `FakeLLMAdapter.resume()`은
   * 이 새 의미에 맞춰 "이어가는 지점 요약"(예: "n번째 줄부터 이어가기"/"새로운 방법으로 처음부터
   * 풀기") 문구를 생성하도록 수정 완료했다(`docs/PROJECT_STATUS.md` 참고) — 더 이상 "완전제곱식"/
   * "판별식" 같은 해법명을 채워 넣지 않는다.
   */
  methodName: string;
  /** 이어풀기 각 단계("무엇을"과 "왜", RESUME-3)를 담은 본문. */
  solutionMd: string;
  answerMd: string;
  /** RESUME-5: CAS 최종 답 검증 통과 여부. */
  verified: boolean;
  /** 도형 시각화(PRD §4.12 FIG). `Solution.figures`와 동일한 의미의 선택 필드다. */
  figures?: FigureSpec[];
  /** 이어풀기 단계(stepId) ↔ 도형(figureId) 연결. 선택 필드다. */
  stepFigureRefs?: StepFigureRef[];
}

/**
 * 이어풀기(RESUME) 스트리밍 이벤트. `SolveStreamEvent`(apps/api LLMAdapter)와 형태는 비슷하지만
 * payload가 `Solution`이 아니라 `ResumeSolution`이라 별도 타입으로 둔다 — PRD §6.2 Step G 문구는
 * `SolveStreamEvent` 재사용을 암시하지만, 승인된 `ResumeResultCard`의 데이터 모양과 맞지 않아
 * 신규 타입으로 분리했다.
 */
export type ResumeStreamEvent = { delta: string } | { done: true; result: ResumeSolution } | { error: string };

/* -------------------------------------------------------------------------------------------------
 * 도형 시각화(FigureSpec) — PRD §4.12 FIG, 상세 규약은 `docs/FIGURE_SPEC.md`.
 *
 * - 순수 데이터 명세만 정의한다. AI가 만든 JavaScript·HTML·SVG를 담는 필드는 없다.
 * - 스타일(색·선 두께 등) 필드는 두지 않는다 — 렌더러가 `role`·강조 상태를 디자인 토큰에 매핑한다.
 * - 도형 내부의 선택값은 `T | null` + 필수 키로 둔다(OpenAI strict 구조화 출력과 대응).
 * - 수치 라벨 문자열(예: "5cm")은 받지 않는다. 길이·각도 표시는 `showLength`/`showMeasure`로
 *   렌더러가 계산한 값을 쓴다.
 * - 런타임 검증 스키마는 `validation` 패키지(`packages/validation/src/figures.ts`)에 있다.
 * ---------------------------------------------------------------------------------------------- */

/** 풀이 단계 ID. 형식 `^s[1-9][0-9]?$`(s1~s99). sN은 풀이 섹션의 N번째 `**N단계**`에 대응한다. */
export type FigureStepId = string;

/** 도형 내부 요소 ID. 형식 `^[A-Za-z][A-Za-z0-9_]{0,15}$`. */
export type FigureElementId = string;

/** 함수 그래프용 제한 수식 AST. 문자열 수식은 받지 않는다(eval 금지). */
export type ExprNode =
  | { type: "num"; value: number }
  | { type: "var"; name: "x" }
  | { type: "const"; name: "pi" | "e" }
  | { type: "add" | "sub" | "mul" | "div" | "pow"; args: [ExprNode, ExprNode] }
  | { type: "neg"; arg: ExprNode }
  | { type: "fn"; name: "sin" | "cos" | "tan" | "sqrt" | "abs" | "ln" | "log10" | "exp"; arg: ExprNode };

/** 요소의 의미 역할 — 원문 조건(given) / 보조 요소(auxiliary) / 결과(result). */
export type FigureElementRole = "given" | "auxiliary" | "result";

/** 모든 도형 요소의 공통 필드. */
export interface FigureElementBase {
  id: FigureElementId;
  /** 표시 라벨(1~16자, 제어문자와 `<`·`>`·`&` 금지). 없으면 null. */
  label: string | null;
  role: FigureElementRole;
  /** 처음 나타나는 단계. null이면 처음부터 표시한다. */
  appearAt: FigureStepId | null;
}

/** 좌표를 직접 갖는 자유 점. */
export interface FigurePointElement extends FigureElementBase {
  type: "point";
  x: number;
  y: number;
}

/** 두 점의 중점(파생 — 좌표를 갖지 않는다). */
export interface FigureMidpointElement extends FigureElementBase {
  type: "midpoint";
  of: [FigureElementId, FigureElementId];
}

/** 점 `from`에서 선(`to`: segment/line/ray/lineEquation)에 내린 수선의 발(파생). */
export interface FigureFootElement extends FigureElementBase {
  type: "foot";
  from: FigureElementId;
  to: FigureElementId;
}

/** 두 곡선/직선의 교점(파생). 해가 둘이면 `pick`으로 고른다. */
export interface FigureIntersectionElement extends FigureElementBase {
  type: "intersection";
  of: [FigureElementId, FigureElementId];
  pick: 0 | 1;
}

/**
 * 원 밖의 점 `from`에서 원 `circle`에 그은 접선의 접점(파생).
 * `select`: 중심 O에서 볼 때 벡터 OP(P=from)를 반시계(ccw)/시계(cw) 방향으로 돌려 만나는 접점.
 */
export interface FigureTangentPointElement extends FigureElementBase {
  type: "tangentPoint";
  circle: FigureElementId;
  from: FigureElementId;
  select: "ccw" | "cw";
}

/** 함수 그래프 위 x좌표의 점(파생 — y는 그래프에서 계산한다). */
export interface FigurePointOnGraphElement extends FigureElementBase {
  type: "pointOnGraph";
  graph: FigureElementId;
  x: number;
}

/** 두 점을 지나는 선분/직선/반직선. */
export interface FigureLineLikeElement extends FigureElementBase {
  type: "segment" | "line" | "ray";
  through: [FigureElementId, FigureElementId];
  showLength: boolean;
}

/** 방정식 ax + by = c로 정의한 직선. */
export interface FigureLineEquationElement extends FigureElementBase {
  type: "lineEquation";
  a: number;
  b: number;
  c: number;
}

/** 원. `radius`와 `through` 중 정확히 하나만 값을 갖는다. */
export interface FigureCircleElement extends FigureElementBase {
  type: "circle";
  center: FigureElementId;
  radius: number | null;
  through: FigureElementId | null;
}

/** 다각형(꼭짓점 3~12개). */
export interface FigurePolygonElement extends FigureElementBase {
  type: "polygon";
  vertices: FigureElementId[];
}

/** 각 ∠abc(꼭짓점은 가운데 점 b). */
export interface FigureAngleElement extends FigureElementBase {
  type: "angle";
  points: [FigureElementId, FigureElementId, FigureElementId];
  showMeasure: boolean;
  rightAngleMark: boolean;
}

/** y = expr(x) 함수 그래프. `domain`이 null이면 boundingBox 가로 범위 전체. */
export interface FigureFunctionGraphElement extends FigureElementBase {
  type: "functionGraph";
  expr: ExprNode;
  domain: [number, number] | null;
}

export type FigureElement =
  | FigurePointElement
  | FigureMidpointElement
  | FigureFootElement
  | FigureIntersectionElement
  | FigureTangentPointElement
  | FigurePointOnGraphElement
  | FigureLineLikeElement
  | FigureLineEquationElement
  | FigureCircleElement
  | FigurePolygonElement
  | FigureAngleElement
  | FigureFunctionGraphElement;

/** 제약의 출처 — 문제 원문 조건(given) / 풀이 중 도출(derived). */
export type FigureConstraintSource = "given" | "derived";

export type FigureConstraint = { source: FigureConstraintSource } & (
  | { type: "perpendicular" | "parallel" | "equalLength"; a: FigureElementId; b: FigureElementId }
  | { type: "length"; segment: FigureElementId; value: number }
  | { type: "angleMeasure"; angle: FigureElementId; degrees: number }
  | { type: "pointOnCircle"; point: FigureElementId; circle: FigureElementId }
  | { type: "pointOnLine"; point: FigureElementId; line: FigureElementId }
  | { type: "tangent"; line: FigureElementId; circle: FigureElementId }
  | { type: "collinear"; points: FigureElementId[] }
);

/** 단계별 강조/숨김 상태. 앞 단계에서 나타난 요소는 `hide`에 없으면 유지된다. */
export interface FigureStepState {
  stepId: FigureStepId;
  highlight: FigureElementId[];
  hide: FigureElementId[];
}

/** 보기 모드 — 고정(fixed) 또는 제약을 보존하는 탐색(explore, 지정한 자유 점만 드래그 가능). */
export type FigureInteraction = { mode: "fixed" } | { mode: "explore"; draggable: FigureElementId[] };

/** 도형 명세 1건(schemaVersion 1). */
export interface FigureSpec {
  schemaVersion: 1;
  /** 형식 `^fig-[a-z0-9]{1,16}$`. */
  figureId: string;
  kind: "geometry" | "function";
  /** 텍스트 대체 설명(1~500자). 렌더링 실패·접근성용. */
  description: string;
  /** [left, top, right, bottom] — left < right, top > bottom. */
  boundingBox: [number, number, number, number];
  axes: { visible: boolean; xLabel: string | null; yLabel: string | null };
  grid: { visible: boolean };
  /** geometry이면 true만 허용(동일 축 단위 비율). */
  keepAspectRatio: boolean;
  interaction: FigureInteraction;
  /** 의존 순서대로 나열한다(앞쪽 요소만 참조 가능 — 참조 검증은 Stage 2 검증기). */
  elements: FigureElement[];
  constraints: FigureConstraint[];
  steps: FigureStepState[];
}

/** 풀이 단계 ↔ 도형 연결. */
export interface StepFigureRef {
  stepId: FigureStepId;
  figureId: string;
}
