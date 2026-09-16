import {
  getActionBarState,
  type ActionBarStateInput,
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
  /** "새 문제 풀기"(RESULT 단계, [1] 세그먼트의 라벨/행동이 전환된 상태) 클릭 시 호출된다. */
  onNewProblem?: () => void;
}

type SolveStage = "input" | "work-notyet" | "work-done" | "result";

/** `shared/lib/solve/actionBarState`의 `deriveSolveStage`(비공개)와 동일한 4-way 기준을 이
 *  컴포넌트의 렌더링(어느 세그먼트를 강조할지) 판단에도 그대로 쓴다 — enabled/disabled 상태표는
 *  건드리지 않고, "지금 단계의 주 행동이 무엇인지"만 별도로 계산한다. */
function deriveStage(
  problemId: string | null,
  hasWorkInput: boolean,
  solveStatus: ActionBarStateInput["solveStatus"],
  diagnoseStatus: ActionBarStateInput["diagnoseStatus"],
): SolveStage {
  if (problemId === null) {
    return "input";
  }
  if (solveStatus === "success" || diagnoseStatus === "success") {
    return "result";
  }
  return hasWorkInput ? "work-done" : "work-notyet";
}

/** Figma `Solve/Action Bar`(마스터 `260:101`) 세그먼트 공통 베이스. `Stage=Problem`(`260:92`)/
 *  `Stage=Work`(`249:69`) variant 실측 — `px-[20px] py-[10px]`, 완전 라운드. 텍스트는 Figma
 *  `260:101`/`260:92`/`249:69` 실측 `font-size: 14px`, `line-height: 100%`(≈14px) —
 *  `docs/DESIGN_SYSTEM.md`에 별도 14px 스케일 항목 없어 arbitrary value 직접 사용. */
const SEGMENT_BASE_STYLE =
  "rounded-full px-[20px] py-[10px] text-[14px] font-[590] leading-[normal] transition-[background-color,filter] " +
  "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed";

/** 강조(그 단계의 주 행동) 세그먼트 — `bg-brand-deep` + `text-label-on-dark` + `Elevation/Floating Bar`
 *  (`docs/DESIGN_SYSTEM.md` §4) 그림자를 세그먼트 자체에 적용한다. 비활성 시 옅어지고(`disabled:opacity-40`),
 *  누르는 동안(`active:enabled:brightness-90`) 기존 배경색을 어둡게 해 눌림 피드백을 준다 —
 *  새 색상을 만들지 않고 CSS 필터만 적용한다. */
const EMPHASIZED_SEGMENT_STYLE =
  "bg-brand-deep text-label-on-dark disabled:opacity-40 active:enabled:brightness-90 " +
  "drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] " +
  "shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]";

/** 그 단계의 주 행동이 아니지만 여전히 활성(클릭 가능)인 세그먼트 — 배경 없이 텍스트만.
 *  누르는 동안(`active:enabled:bg-fill-quaternary`) 옅은 배경이 잠깐 나타나 눌림 피드백을 준다. */
const PLAIN_ACTIVE_SEGMENT_STYLE =
  "bg-transparent text-label-secondary disabled:opacity-40 active:enabled:bg-fill-quaternary";

/** 그 단계와 무관한(비활성) 세그먼트 — 배경 없이 텍스트만, 항상 옅게. */
const PLAIN_INACTIVE_SEGMENT_STYLE = "bg-transparent text-label-secondary opacity-40";

/** "아직 못 풀겠어요" 세그먼트 전용 "고스트 필" 스타일 — Figma 재실측(`Stage=Problem`/`Stage=Work`)
 *  결과, 이 세그먼트는 강조가 아닐 때도 다른 두 세그먼트와 달리 옅은 회색 필(pill) 모양 +
 *  `EMPHASIZED_SEGMENT_STYLE`과 동일한 5-레이어 그림자를 갖는다. `Stage=Work`(`work-done`)에서는
 *  버튼이 실제로는 활성(클릭 가능)인데도 이 옅은 스타일을 유지해야 하므로, `opacity-40`을
 *  `disabled:` modifier가 아니라 리터럴 클래스로 직접 적용한다 — 실제 `disabled` 여부는
 *  `buttonState.giveUp.enabled`가 그대로 결정한다(시각 스타일과 무관). */
const GHOST_PILL_SEGMENT_STYLE =
  "bg-bg-scrim text-label-primary opacity-40 " +
  "drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] " +
  "shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]";

function segmentClassName(isEmphasized: boolean, isActiveForStage: boolean): string {
  if (isEmphasized) {
    return `${SEGMENT_BASE_STYLE} ${EMPHASIZED_SEGMENT_STYLE}`;
  }
  return `${SEGMENT_BASE_STYLE} ${isActiveForStage ? PLAIN_ACTIVE_SEGMENT_STYLE : PLAIN_INACTIVE_SEGMENT_STYLE}`;
}

/** "아직 못 풀겠어요" 세그먼트 전용 className 계산 — 다른 두 세그먼트("문제 인식하기"/"봐 주세요")는
 *  기존 공용 `segmentClassName`을 그대로 쓰지만, 이 세그먼트만 Figma 재실측으로 예외적인 시각 규칙이
 *  생겨 별도 함수로 분리한다:
 *  - `work-notyet`(이 세그먼트가 그 단계의 주 행동): 기존과 동일하게 강조.
 *  - `input`/`work-done`(강조는 아니지만 각각 disabled/enabled): 신규 고스트 필.
 *  - `result`(RESULT 단계, Figma `Stage=NewProblem`에서 변경 없음 확인): 기존 plain 비활성 그대로. */
function giveUpSegmentClassName(stage: SolveStage): string {
  if (stage === "work-notyet") {
    return `${SEGMENT_BASE_STYLE} ${EMPHASIZED_SEGMENT_STYLE}`;
  }
  if (stage === "input" || stage === "work-done") {
    return `${SEGMENT_BASE_STYLE} ${GHOST_PILL_SEGMENT_STYLE}`;
  }
  return `${SEGMENT_BASE_STYLE} ${PLAIN_INACTIVE_SEGMENT_STYLE}`;
}

/** 세그먼트 사이 구분선. Figma 실측: `w-px h-[22px] bg-separator`. */
function ActionBarDivider() {
  return <div aria-hidden="true" className="bg-separator h-[22px] w-px" />;
}

/**
 * Figma `Solve/Action Bar`(마스터 `260:101`, variant `Stage=Problem`=`260:92`/`Stage=Work`=`249:69`,
 * 인스턴스는 `3-1 · Solve/Pencilcanvas`(`127:445`) 안의 `256:405`) v2.0 — "문제 인식하기(또는
 * "새 문제 풀기") / 아직 못 풀겠어요 / 봐 주세요" 세그먼트 컨트롤. 기존 개념설명/풀이 체크박스 2개 +
 * "풀기" 단일 버튼 구조(`~~SOLVE-1~~`, DEPRECATED)는 완전히 폐기됐다.
 *
 * "3개의 독립 버튼"이 아니라 "1개의 세그먼트 컨트롤"이다 — 컨테이너(`gap-[2px] p-[6px]
 * rounded-full border-brand`, `border-[0.5px]`) 안에 세그먼트 3개와 구분선(divider) 2개가 함께
 * 들어간다. 컨테이너 자체는 Figma 4개 variant(`260:92`/`249:69`/`267:682`/`267:454`) 최상위 노드
 * 재실측으로 배경(fill)이 전혀 없고(완전 투명), 그림자도 없으며, 보더는 `border-brand` 색상 +
 * `0.5px` 두께(Tailwind 기본 `border`는 1px라 표현 불가해 arbitrary value 사용)로 확정됐다 —
 * 이전에 있던 `bg-glass-fill`과 `Elevation/Floating Bar` 그림자는 컨테이너가 아니라 세그먼트 자체의
 * 스타일(`EMPHASIZED_SEGMENT_STYLE`/`GHOST_PILL_SEGMENT_STYLE`)과 혼동한 오기였다. 그래서
 * `shared/ui/button`의 `Button`/`pill-*` variant를 재사용하지 않고 `<button>`을 이 컴포넌트
 * 전용으로 직접 스타일링한다(`docs/COMPONENT_MAP.md` §2가 Action Bar를 `Button/Pill`과 별개의
 * 화면 전용 요소로 명시).
 *
 * 세그먼트 자리는 고정 3개, 자리 교체 없이 라벨/강조/활성 여부만 단계별로 바뀐다(Figma 문제 인식
 * 스토리보드 `267:778`, `Stage=Notyet`=`267:682`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr` 실측). "고정
 * 3색"이 아니라 "그 단계의 주 행동 1개만 강조, 나머지는 배경 없는 텍스트"다 — 단, "아직 못
 * 풀겠어요"는 강조가 아닌 두 단계(`input`/`work-done`)에서도 예외적으로 옅은 회색 "고스트 필"(배경
 * 있음)로 격상된다(`giveUpSegmentClassName` 참고):
 * - `Stage=Problem`(INPUT, `problemId === null`): "문제 인식하기"만 강조(`bg-brand-deep`),
 *   "아직 못 풀겠어요"는 고스트 필(비활성), "봐 주세요"는 배경 없이 옅게.
 * - WORK-풀이전(`problemId !== null`, 결과 없음, `hasWorkInput === false`): "아직 못 풀겠어요"만
 *   강조, "봐 주세요"는 배경 없이 옅게.
 * - `Stage=Work`(WORK-풀이후, `problemId !== null`, 결과 없음, `hasWorkInput === true`): "봐
 *   주세요"만 강조, "아직 못 풀겠어요"는 고스트 필(활성 — 클릭 가능하지만 배경은 옅게 유지),
 *   "문제 인식하기"는 배경 없이 옅게.
 * - RESULT(`solveStatus === "success"` 또는 `diagnoseStatus === "success"`): [1] 세그먼트의
 *   라벨이 "새 문제 풀기"로 바뀌며 다시 강조되고, "아직 못 풀겠어요"는 Figma `Stage=NewProblem`
 *   실측대로 다시 배경 없는 plain 비활성으로 돌아간다(고스트 필 아님).
 *
 * 어느 세그먼트가 활성/비활성인지(`disabled` 여부)는 이 컴포넌트가 직접 판단하지 않고
 * `shared/lib/solve/actionBarState`의 순수함수 `getActionBarState`(상태표 기반, 수정하지 않음)에
 * 위임한다. 이 컴포넌트가 새로 계산하는 것은 "어느 세그먼트가 그 단계의 주 행동인지"(강조 여부)와
 * "[1] 세그먼트의 라벨/클릭 핸들러가 무엇인지"(RESULT 단계의 "새 문제 풀기" 전환)뿐이다.
 */
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
  const buttonState = getActionBarState({
    problemId,
    hasProblemInput,
    hasWorkInput,
    recognizeStatus,
    solveStatus,
    recognizeWorkStatus,
    diagnoseStatus,
  });
  const stage = deriveStage(problemId, hasWorkInput, solveStatus, diagnoseStatus);
  const isResultStage = stage === "result";

  return (
    <div className="border-brand flex w-fit items-center gap-[2px] rounded-full border-[0.5px] p-[6px]">
      <button
        type="button"
        className={segmentClassName(stage === "input" || isResultStage, false)}
        disabled={!buttonState.recognize.enabled}
        onClick={isResultStage ? onNewProblem : onRecognize}
      >
        {isResultStage ? "새 문제 풀기" : "문제 인식하기"}
      </button>
      <ActionBarDivider />
      <button
        type="button"
        className={giveUpSegmentClassName(stage)}
        disabled={!buttonState.giveUp.enabled}
        onClick={onGiveUp}
      >
        아직 못 풀겠어요
      </button>
      <ActionBarDivider />
      <button
        type="button"
        className={segmentClassName(stage === "work-done", false)}
        disabled={!buttonState.diagnose.enabled}
        onClick={onDiagnose}
      >
        봐 주세요
      </button>
    </div>
  );
}
