import {
  getActionBarState,
  type ActionBarStateInput,
} from "../../shared/lib/solve/actionBarState";

interface ActionBarProps {
  /** recognize 성공 시 채워지는 문제 ID. `null`이면 아직 INPUT 단계(문제 인식 전)다. */
  problemId: string | null;
  /** 사진 또는 필기 입력이 있는지 — INPUT 단계에서 "문제 인식하기" 활성화 조건. */
  hasProblemInput: boolean;
  /** `useRecognizeProblem().status`(또는 동일한 값 집합)를 그대로 전달한다. */
  recognizeStatus: ActionBarStateInput["recognizeStatus"];
  /** `useSolveStream().status`(또는 동일한 값 집합)를 그대로 전달한다. */
  solveStatus: ActionBarStateInput["solveStatus"];
  /** "문제 인식하기"(INPUT 단계) 클릭 시 호출된다. 전달하지 않으면 클릭해도 아무 동작이 없다. */
  onRecognize?: () => void;
  /** "아직 못 풀겠어요"(WORK 단계, WORK-4) 클릭 시 호출된다. */
  onGiveUp?: () => void;
  /** "봐 주세요"(WORK 단계, SOLVE-2) 클릭 시 호출된다. */
  onDiagnose?: () => void;
}

type SolveStage = "input" | "work" | "result";

/** `shared/lib/solve/actionBarState`의 `deriveSolveStage`(비공개)와 동일한 규칙을 이 컴포넌트의
 *  렌더링(어느 세그먼트를 강조할지) 판단에도 그대로 쓴다 — enabled/disabled 상태표는 건드리지 않고,
 *  "지금 단계의 주 행동이 무엇인지"만 별도로 계산한다. */
function deriveStage(problemId: string | null, solveStatus: ActionBarStateInput["solveStatus"]): SolveStage {
  if (problemId === null) {
    return "input";
  }
  if (solveStatus === "success") {
    return "result";
  }
  return "work";
}

/** Figma `Solve/Action Bar`(마스터 `260:101`) 세그먼트 공통 베이스. `Stage=Problem`(`260:92`)/
 *  `Stage=Work`(`249:69`) variant 실측 — `px-[20px] py-[10px]`, 완전 라운드. 텍스트는 Figma
 *  `260:101`/`260:92`/`249:69` 실측 `font-size: 14px`, `line-height: 100%`(≈14px) —
 *  `docs/DESIGN_SYSTEM.md`에 별도 14px 스케일 항목 없어 arbitrary value 직접 사용. */
const SEGMENT_BASE_STYLE =
  "rounded-full px-[20px] py-[10px] text-[14px] font-semibold leading-[normal] transition-colors " +
  "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed";

/** 강조(그 단계의 주 행동) 세그먼트 — `bg-brand-deep` + `text-label-on-dark` + `Elevation/Floating Bar`
 *  (`docs/DESIGN_SYSTEM.md` §4) 그림자를 세그먼트 자체에 적용한다. */
const EMPHASIZED_SEGMENT_STYLE =
  "bg-brand-deep text-label-on-dark " +
  "drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] " +
  "shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]";

/** 그 단계의 주 행동이 아니지만 여전히 활성(클릭 가능)인 세그먼트 — 배경 없이 텍스트만. */
const PLAIN_ACTIVE_SEGMENT_STYLE = "bg-transparent text-label-secondary disabled:opacity-40";

/** 그 단계와 무관한(비활성) 세그먼트 — 배경 없이 텍스트만, 항상 옅게. */
const PLAIN_INACTIVE_SEGMENT_STYLE = "bg-transparent text-label-secondary opacity-40";

function segmentClassName(isEmphasized: boolean, isActiveForStage: boolean): string {
  if (isEmphasized) {
    return `${SEGMENT_BASE_STYLE} ${EMPHASIZED_SEGMENT_STYLE}`;
  }
  return `${SEGMENT_BASE_STYLE} ${isActiveForStage ? PLAIN_ACTIVE_SEGMENT_STYLE : PLAIN_INACTIVE_SEGMENT_STYLE}`;
}

/** 세그먼트 사이 구분선. Figma 실측: `w-px h-[22px] bg-separator`. */
function ActionBarDivider() {
  return <div aria-hidden="true" className="bg-separator h-[22px] w-px" />;
}

/**
 * Figma `Solve/Action Bar`(마스터 `260:101`, variant `Stage=Problem`=`260:92`/`Stage=Work`=`249:69`,
 * 인스턴스는 `3-1 · Solve/Pencilcanvas`(`127:445`) 안의 `256:405`) v2.0 — "문제 인식하기 / 아직
 * 못 풀겠어요 / 봐 주세요" 세그먼트 컨트롤. 기존 개념설명/풀이 체크박스 2개 + "풀기" 단일 버튼 구조
 * (`~~SOLVE-1~~`, DEPRECATED)는 완전히 폐기됐다.
 *
 * "3개의 독립 버튼"이 아니라 "1개의 세그먼트 컨트롤"이다 — 컨테이너(`gap-[2px] p-[6px]
 * rounded-full bg-glass-fill border-glass-border`) 안에 세그먼트 3개와 구분선(divider) 2개가
 * 함께 들어간다. 그래서 `shared/ui/button`의 `Button`/`pill-*` variant를 재사용하지 않고
 * `<button>`을 이 컴포넌트 전용으로 직접 스타일링한다(`docs/COMPONENT_MAP.md` §2가 Action Bar를
 * `Button/Pill`과 별개의 화면 전용 요소로 명시).
 *
 * 스타일은 "고정 3색"이 아니라 "그 단계의 주 행동 1개만 강조, 나머지는 배경 없는 텍스트"다:
 * - `Stage=Problem`(INPUT, `problemId === null`): "문제 인식하기"만 강조(`bg-brand-deep`),
 *   나머지 둘은 배경 없이 옅게(`opacity-40`).
 * - `Stage=Work`(WORK, `problemId !== null && solveStatus !== "success"`): "봐 주세요"만 강조,
 *   "아직 못 풀겠어요"는 배경 없는 텍스트(활성), "문제 인식하기"는 배경 없이 옅게.
 * - RESULT(`solveStatus === "success"`)는 대응하는 Figma variant가 없다 — 3개 버튼 모두
 *   `getActionBarState`가 비활성으로 판정하므로, 강조 없이 모두 옅은 상태로 렌더링한다.
 *
 * 어느 세그먼트가 활성/비활성인지(`disabled` 여부)는 이 컴포넌트가 직접 판단하지 않고
 * `shared/lib/solve/actionBarState`의 순수함수 `getActionBarState`(상태표 기반, 수정하지 않음)에
 * 위임한다. 이 컴포넌트가 새로 계산하는 것은 "어느 세그먼트가 그 단계의 주 행동인지"(강조 여부)뿐이다.
 */
export function ActionBar({
  problemId,
  hasProblemInput,
  recognizeStatus,
  solveStatus,
  onRecognize,
  onGiveUp,
  onDiagnose,
}: ActionBarProps) {
  const buttonState = getActionBarState({
    problemId,
    hasProblemInput,
    recognizeStatus,
    solveStatus,
  });
  const stage = deriveStage(problemId, solveStatus);

  return (
    <div className="bg-glass-fill border-glass-border flex w-fit items-center gap-[2px] rounded-full border p-[6px] drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]">
      <button
        type="button"
        className={segmentClassName(stage === "input", false)}
        disabled={!buttonState.recognize.enabled}
        onClick={onRecognize}
      >
        문제 인식하기
      </button>
      <ActionBarDivider />
      <button
        type="button"
        className={segmentClassName(false, stage === "work")}
        disabled={!buttonState.giveUp.enabled}
        onClick={onGiveUp}
      >
        아직 못 풀겠어요
      </button>
      <ActionBarDivider />
      <button
        type="button"
        className={segmentClassName(stage === "work", false)}
        disabled={!buttonState.diagnose.enabled}
        onClick={onDiagnose}
      >
        봐 주세요
      </button>
    </div>
  );
}
