import type { ComponentType } from "react";
import {
  getActionBarState,
  getActionBarVisualState,
  type ActionBarButtonState,
  type ActionBarStateInput,
  type ActionBarVisualState,
} from "../../shared/lib/solve/actionBarState";

interface ActionBarProps {
  /** recognize 성공 시 채워지는 문제 ID. `null`이면 아직 INPUT 단계(문제 인식 전)다. */
  problemId: string | null;
  /** 사진 또는 필기 입력이 있는지 — INPUT 단계에서 "문제 인식하기" 활성화 조건. */
  hasProblemInput: boolean;
  /** WORK 캔버스에 입력이 있는지(`workStrokes.length > 0 || workLines !== null`) — WORK 단계를
   *  "풀이전"/"풀이후" 두 서브스테이트로 나누는 기준. */
  hasWorkInput: ActionBarStateInput["hasWorkInput"];
  /** `useRecognizeProblem().status`(또는 동일한 값 집합)를 그대로 전달한다. */
  recognizeStatus: ActionBarStateInput["recognizeStatus"];
  /** `useSolveStream().status`(또는 동일한 값 집합)를 그대로 전달한다. */
  solveStatus: ActionBarStateInput["solveStatus"];
  /** `useRecognizeWork().status`(또는 동일한 값 집합)를 그대로 전달한다. */
  recognizeWorkStatus: ActionBarStateInput["recognizeWorkStatus"];
  /** `useDiagnose().status`(또는 동일한 값 집합)를 그대로 전달한다. */
  diagnoseStatus: ActionBarStateInput["diagnoseStatus"];
  /** "문제 인식하기"(INPUT 단계) 클릭 시 호출된다. 전달하지 않으면 클릭해도 아무 동작이 없다. */
  onRecognize?: () => void;
  /** "아직 못 풀겠어요"(WORK 단계, WORK-4) 클릭 시 호출된다. */
  onGiveUp?: () => void;
  /** "봐 주세요"(WORK 단계, SOLVE-2) 클릭 시 호출된다. */
  onDiagnose?: () => void;
  /** "새 문제 풀기"(RESULT 단계) 클릭 시 호출된다. */
  onNewProblem?: () => void;
}

/** Figma `Icon/PlayCircle`(action-bar 아이콘 자산 `play_circle.svg`, `viewBox 0 0 18 18`) 실제
 *  벡터 경로를 인라인한 것 — 색상은 하드코딩하지 않고 `currentColor`로 상속한다(`PenRail.tsx`의
 *  `PenGlyph`/`EraseGlyph`와 동일한 기존 관례). "문제 인식하기(비활성)" 상태도 별도 파일 없이 이
 *  글리프를 그대로 재사용하고 색만 다르게 적용한다. */
function PlayCircleGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-[18px]">
      <g transform="translate(1.5,1.5)">
        <path
          fill="currentColor"
          d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM6 10.875V4.125L10.5 7.5L6 10.875Z"
        />
      </g>
    </svg>
  );
}

/** Figma `Icon/Dissatisfied`(`dissatisfied.svg`, `viewBox 0 0 18 18`) 실제 벡터 경로 인라인. */
function DissatisfiedGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-[18px]">
      <g transform="translate(1.5,1.5)">
        <path
          fill="currentColor"
          d="M7.5 8.625C5.7525 8.625 4.2675 9.72 3.6675 11.25H11.3325C10.7325 9.72 9.2475 8.625 7.5 8.625ZM4.365 7.5L5.16 6.705L5.955 7.5L6.75 6.705L5.955 5.91L6.75 5.115L5.955 4.32L5.16 5.115L4.365 4.32L3.57 5.115L4.365 5.91L3.57 6.705L4.365 7.5ZM7.4925 0C3.3525 0 0 3.3525 0 7.5C0 11.6475 3.3525 15 7.4925 15C11.6325 15 15 11.6475 15 7.5C15 3.3525 11.64 0 7.4925 0ZM7.5 13.5C4.185 13.5 1.5 10.815 1.5 7.5C1.5 4.185 4.185 1.5 7.5 1.5C10.815 1.5 13.5 4.185 13.5 7.5C13.5 10.815 10.815 13.5 7.5 13.5ZM10.635 4.32L9.84 5.115L9.045 4.32L8.25 5.115L9.045 5.91L8.25 6.705L9.045 7.5L9.84 6.705L10.635 7.5L11.43 6.705L10.635 5.91L11.43 5.115L10.635 4.32Z"
        />
      </g>
    </svg>
  );
}

/** Figma `Icon/Satisfied`(`satisfied.svg`, `viewBox 0 0 18 18`) 실제 벡터 경로 인라인. */
function SatisfiedGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-[18px]">
      <g transform="translate(1.5,1.5)">
        <path
          fill="currentColor"
          d="M7.4925 0C3.3525 0 0 3.36 0 7.5C0 11.64 3.3525 15 7.4925 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.4925 0ZM7.5 13.5C4.185 13.5 1.5 10.815 1.5 7.5C1.5 4.185 4.185 1.5 7.5 1.5C10.815 1.5 13.5 4.185 13.5 7.5C13.5 10.815 10.815 13.5 7.5 13.5ZM7.5 10.5C6.39 10.5 5.4375 9.8925 4.9125 9H3.66C4.26 10.5375 5.7525 11.625 7.5 11.625C9.2475 11.625 10.74 10.5375 11.34 9H10.0875C9.5625 9.8925 8.61 10.5 7.5 10.5Z"
        />
      </g>
      <g transform="translate(10.5,6)">
        <path
          fill="currentColor"
          d="M1.125 2.25C1.74632 2.25 2.25 1.74632 2.25 1.125C2.25 0.50368 1.74632 0 1.125 0C0.50368 0 0 0.50368 0 1.125C0 1.74632 0.50368 2.25 1.125 2.25Z"
        />
      </g>
      <g transform="translate(5.25,6)">
        <path
          fill="currentColor"
          d="M1.125 2.25C1.74632 2.25 2.25 1.74632 2.25 1.125C2.25 0.50368 1.74632 0 1.125 0C0.50368 0 0 0.50368 0 1.125C0 1.74632 0.50368 2.25 1.125 2.25Z"
        />
      </g>
    </svg>
  );
}

interface ActionBarButtonSpec {
  label: string;
  caption: string;
  bgClassName: string;
  borderClassName: string;
  /** 라벨과 아이콘이 같은 색을 공유한다(버튼에 적용, `currentColor`로 아이콘에 상속) — 5개 상태
   *  전부 Figma 실측상 라벨/아이콘 색이 동일해 하나의 클래스로 통일한다. */
  colorClassName: string;
  /** 폰트 크기 + 줄 높이(`leading-*`)를 함께 묶는다 — design-agent가 Figma raw Variable
   *  (`get_variable_defs`, node `267:462`)로 재실측(2026-09)한 결과 5개 상태 전부 동일한
   *  `text-[17px] leading-[22px]`다. `result`만 14px라는 별도 변수는 Figma 어디에도 없었다 —
   *  이전 구현(`text-[14px] leading-[normal]`)은 오측이었다. */
  fontSizeClassName: string;
  captionColorClassName: string;
  /** design-agent 사후검수(2026-09) Figma `get_metadata` 좌표 재실측 반영 — 버튼(pill) 자체의 폭이며
   *  hug-content가 아니라 상태별 고정폭이다(`Problem`/`Problem_disable` 271px, `Notyet`/`Work`/
   *  `NewProblem` 263px). 이전 라운드에서 283px로 썼던 값은 버튼을 감싼 바깥 프레임 폭(상하좌우 6px
   *  패딩 포함)과 버튼 자체 폭을 혼동한 것이었다. */
  widthClassName: string;
  Icon: ComponentType | null;
}

/**
 * Figma `Solve/Action Bar`(마스터 `260:101`) v3.0 — 오너 승인으로 기존 "문제 인식하기(또는 새 문제
 * 풀기) / 아직 못 풀겠어요 / 봐 주세요" 3세그먼트 구조(`~~SEGMENT_BASE_STYLE~~` 등, DEPRECATED)를
 * 완전히 폐기하고, "항상 버튼 1개(라벨/배경/보더/아이콘/캡션이 단계마다 통째로 바뀌는 단일 CTA) + 그
 * 아래 보조 캡션 텍스트" 구조로 교체했다(2026-09).
 *
 * 5개 상태(`ActionBarVisualState`, `shared/lib/solve/actionBarState`) 각각에서 정확히 1개의 버튼과
 * 1개의 캡션만 렌더된다 — 자리 교체가 있던 기존 3세그먼트와 달리 "이 단계의 유일한 행동"만 보여준다:
 * - `input-empty`: INPUT 단계, 아직 인식시킬 입력이 없어 "문제 인식하기"가 비활성.
 * - `input-filled`: INPUT 단계, 입력이 있어 "문제 인식하기"가 활성/강조.
 * - `work-notyet`: WORK 단계, 아직 풀이가 없어 "아직 못 풀겠어요"만 노출.
 * - `work-done`: WORK 단계, 풀이가 생겨 "봐 주세요"만 노출("아직 못 풀겠어요"는 이 단계에서 더 이상
 *   보이지 않는다 — 3세그먼트 시절과 다른 부분).
 * - `result`: 결과 표시 중, "새 문제 풀기"만 노출.
 *
 * 라벨/아이콘 색이 "?"였던 3곳(오너 지시, `docs/DESIGN_TOKEN_MAP.md`에 없는 판단 사항)은 최초엔 기존
 * 코드의 전례를 따라 근사값(`input-empty`: `text-bg-scrim`, `work-notyet`: `text-icon-default`,
 * 배경도 둘 다 `bg-bg-scrim`)으로 정했으나, 2026-09 오너 실기기 피드백 + Figma 재실측(`260:101`
 * Solve/Action Bar, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`)으로 다음 실측 토큰으로 교체했다
 * (`docs/DESIGN_TOKEN_MAP.md` 참고):
 * - `input-empty`: 라벨/아이콘 색을 `Problem_disable_font`(`--color-action-disabled-fg`,
 *   `#8f9d99`)로 교체. 배경(`bg-surface-well`)/보더(`border-bg-scrim`)는 재실측으로 변경 없음이
 *   확인되어 그대로 유지한다.
 * - `work-notyet`: 배경을 `Problem_notsolve_button_color`(`--color-action-notyet-bg`,
 *   `#b0d4ca`)로, 라벨/아이콘 색을 `Problem_nosolve_font`(`--color-action-notyet-fg`, `#6f7b75`)로
 *   교체. 보더(`border-brand-deep`)는 재실측으로 변경 없음이 확인되어 그대로 유지한다.
 * - `result`: 배경이 진한 `bg-accent-red`라 다른 두 강조 상태(`input-filled`의 `bg-accent-green`,
 *   `work-done`의 `bg-accent-teal`)와 동일하게 `text-label-on-dark`를 썼다 — "진한 배경엔 흰
 *   텍스트"라는 이 컴포넌트의 나머지 4곳과 일관된 규칙이다(이 상태는 2026-09 재실측 대상이 아니었다).
 *
 * Corner Radius(2026-09 오너 실기기 피드백 + Figma 재실측): 5개 상태 전부 예외 없이 top-right만
 * 0px(각짐)이고 나머지 3개 코너(top-left/bottom-right/bottom-left)는 완전 라운드(999px, pill)다 —
 * 버튼 공통 클래스에 `rounded-full` 대신 `rounded-tl-full rounded-bl-full rounded-br-full`(top-right
 * 라운드 클래스 없음 = 0)을 적용한다. 상태별 분기가 필요 없다.
 *
 * 버튼 폭은 hug-content가 아니라 design-agent 사후검수(2026-09) Figma `get_metadata` 좌표 재실측으로
 * 확정된 상태별 고정폭이다 — `input-empty`/`input-filled`(Problem/Problem_disable)는 271px,
 * `work-notyet`(Notyet)/`work-done`(Work)/`result`(NewProblem)는 263px(`widthClassName`). 라벨과
 * 아이콘은 5개 상태 전부 버튼 폭 안에서 그룹 전체가 가운데 정렬된다(`justify-center`, 버튼 공통 클래스
 * 에 적용) — 아이콘이 있는 4개 상태도 Figma 좌표 실측상 `justify-between`이 아니라 중앙 정렬이었다.
 * 캡션은 `max-w-[220px]`로 제한해 좁은 화면(세로 모드/Split View)에서 2줄까지 자연스럽게 줄바꿈되되
 * (`whitespace-nowrap`/`truncate` 없음) 항상 `text-center`를 유지한다. 220px는 Figma에 별도
 * 실측값이 없어(색상/그림자와 달리 캡션 컨테이너 폭은 토큰화 대상이 아님) 가장 긴 캡션("버튼을
 * 선택하여 AI가 문제를 분석하게 해주세요")과 버튼 고정폭을 참고해 "버튼보다 약간 넓은 정도"로 정한
 * 값이다(오너 지시 — 임의로 크게 잡지 말 것).
 *
 * 그림자는 5개 상태 모두 기존 `Elevation/Action Segment`(`docs/DESIGN_SYSTEM.md` §4)를 그대로
 * 적용한다 — 비활성(`input-empty`)도 예외 없이 동일 그림자를 유지한다(오너 지시, 별도 실측 근거
 * 없으면 일관 적용).
 */
const BUTTON_VISUAL_SPEC: Record<ActionBarVisualState, ActionBarButtonSpec> = {
  "input-empty": {
    label: "문제 인식하기",
    caption: "먼저 사진이나 필기로 문제를 인식 시켜 주세요",
    bgClassName: "bg-surface-well",
    borderClassName: "border-bg-scrim",
    colorClassName: "text-action-disabled-fg",
    fontSizeClassName: "text-[17px] leading-[22px]",
    captionColorClassName: "text-accent-steel",
    widthClassName: "w-[271px]",
    Icon: PlayCircleGlyph,
  },
  "input-filled": {
    label: "문제 인식하기",
    caption: "버튼을 선택하여 AI가 문제를 분석하게 해주세요",
    bgClassName: "bg-accent-green",
    borderClassName: "border-brand-deep",
    colorClassName: "text-label-on-dark",
    fontSizeClassName: "text-[17px] leading-[22px]",
    captionColorClassName: "text-accent-steel",
    widthClassName: "w-[271px]",
    Icon: PlayCircleGlyph,
  },
  "work-notyet": {
    label: "아직 못 풀겠어요",
    caption: "문제 풀기가 어려우세요?  AI가 도와 드릴게요",
    bgClassName: "bg-action-notyet-bg",
    borderClassName: "border-brand-deep",
    colorClassName: "text-action-notyet-fg",
    fontSizeClassName: "text-[17px] leading-[22px]",
    captionColorClassName: "text-accent-steel",
    widthClassName: "w-[263px]",
    Icon: DissatisfiedGlyph,
  },
  "work-done": {
    label: "봐 주세요",
    caption: "와우, 훌륭해요! 풀이가 맞는지 한번 볼까요?",
    bgClassName: "bg-accent-teal",
    borderClassName: "border-brand-deep",
    colorClassName: "text-label-on-dark",
    fontSizeClassName: "text-[17px] leading-[22px]",
    captionColorClassName: "text-icon-default",
    widthClassName: "w-[263px]",
    Icon: SatisfiedGlyph,
  },
  result: {
    label: "새 문제 풀기",
    caption: "계속 열심히 다음 문제를 풀어 볼까요?",
    bgClassName: "bg-accent-red",
    borderClassName: "border-brand-deep",
    colorClassName: "text-label-on-dark",
    fontSizeClassName: "text-[17px] leading-[22px]",
    captionColorClassName: "text-icon-default",
    widthClassName: "w-[263px]",
    Icon: null,
  },
};

/** 상태별 클릭 핸들러/`disabled` 매핑 — 기능(클릭 시 동작)은 기존과 전혀 바뀌지 않는다. */
function resolveButtonAction(
  visualState: ActionBarVisualState,
  buttonState: ActionBarButtonState,
  handlers: {
    onRecognize?: () => void;
    onGiveUp?: () => void;
    onDiagnose?: () => void;
    onNewProblem?: () => void;
  },
): { onClick?: () => void; disabled: boolean } {
  switch (visualState) {
    case "input-empty":
    case "input-filled":
      return { onClick: handlers.onRecognize, disabled: !buttonState.recognize.enabled };
    case "work-notyet":
      return { onClick: handlers.onGiveUp, disabled: !buttonState.giveUp.enabled };
    case "work-done":
      return { onClick: handlers.onDiagnose, disabled: !buttonState.diagnose.enabled };
    case "result":
      return { onClick: handlers.onNewProblem, disabled: !buttonState.recognize.enabled };
    default:
      return { disabled: true };
  }
}

export function ActionBar({
  problemId,
  hasProblemInput,
  hasWorkInput,
  recognizeStatus,
  solveStatus,
  recognizeWorkStatus,
  diagnoseStatus,
  onRecognize,
  onGiveUp,
  onDiagnose,
  onNewProblem,
}: ActionBarProps) {
  const stateInput: ActionBarStateInput = {
    problemId,
    hasProblemInput,
    hasWorkInput,
    recognizeStatus,
    solveStatus,
    recognizeWorkStatus,
    diagnoseStatus,
  };
  const buttonState = getActionBarState(stateInput);
  const visualState = getActionBarVisualState(stateInput);
  const spec = BUTTON_VISUAL_SPEC[visualState];
  const { onClick, disabled } = resolveButtonAction(visualState, buttonState, {
    onRecognize,
    onGiveUp,
    onDiagnose,
    onNewProblem,
  });
  const Icon = spec.Icon;

  return (
    <div className="flex flex-col items-center gap-[4px]">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={
          "flex h-[46px] items-center justify-center gap-[8px] rounded-tl-full rounded-bl-full rounded-br-full border-[0.5px] px-[20px] py-[10px] " +
          "font-[590] outline-none transition-[background-color,filter] " +
          "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed " +
          "shadow-[0px_20px_34px_rgba(35,43,56,0.08),0px_8px_16px_rgba(35,43,56,0.14),inset_0px_-2px_0px_rgba(35,43,56,0.07)] " +
          `${spec.bgClassName} ${spec.borderClassName} ${spec.colorClassName} ${spec.fontSizeClassName} ` +
          spec.widthClassName
        }
      >
        {spec.label}
        {Icon ? <Icon /> : null}
      </button>
      <p
        className={`max-w-[220px] text-center text-[11px] leading-[13px] font-normal tracking-[0.06px] italic ${spec.captionColorClassName}`}
      >
        {spec.caption}
      </p>
    </div>
  );
}
