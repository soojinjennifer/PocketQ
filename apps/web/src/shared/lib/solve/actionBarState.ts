/**
 * `features/solve-session/ActionBar`(v2.0, "문제 인식하기 / 아직 못 풀겠어요 / 봐 주세요" 3분할)의
 * 버튼별 활성/비활성 상태를 계산하는 순수함수. `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §1.3.1
 * 1단계 정의를 따른다.
 *
 * `shared/`는 어떤 계층(`app`/`pages`/`features`)도 참조하지 않는다(`.claude/rules/frontend.md` §1)
 * — 그래서 `RecognizeStatus`/`SolveStreamStatus`(각각 `features/problem-recognition`,
 * `features/ai-solution` 소유 타입)를 직접 import하지 않고, 동일한 값 집합(`"idle"|"loading"|
 * "success"|"error"`)을 갖는 `AsyncRequestStatus`를 이 파일에서 별도로 정의한다. 두 훅의 상태
 * 값은 구조적으로 동일해 별도 캐스팅 없이 그대로 전달할 수 있다.
 *
 * 단계 판별 기준(기존 `ProblemInputProvider`/`ProblemInputContext`의 실제 상태 필드 기준):
 * - INPUT: `problemId === null` — 아직 문제가 인식되지 않았다. "문제 인식하기"만 활성화 대상이다.
 * - WORK: `problemId !== null`이고 `solveStatus !== "success"` — 문제는 인식됐지만 진단(풀이)
 *   결과가 아직 없다. "아직 못 풀겠어요"/"봐 주세요"가 활성화 대상이다(단, 진단 요청이 이미
 *   진행 중이면 중복 제출을 막기 위해 둘 다 비활성화한다).
 * - RESULT: `solveStatus === "success"` — 진단/이어풀기 결과가 이미 표시 중이다. 3개 버튼 모두
 *   비활성화한다(재요청은 "수정"/"다시 풀기" 등 별도 진입점을 통한다).
 */

export type AsyncRequestStatus = "idle" | "loading" | "success" | "error";

export interface ActionBarStateInput {
  /** recognize 성공 시 채워지는 문제 ID. `null`이면 아직 INPUT 단계다. */
  problemId: string | null;
  /** 사진 또는 필기 입력이 있는지. INPUT 단계에서 "문제 인식하기" 활성화 조건이다. */
  hasProblemInput: boolean;
  /** `useRecognizeProblem().status`와 동일한 값 집합. */
  recognizeStatus: AsyncRequestStatus;
  /** `useSolveStream().status`와 동일한 값 집합. */
  solveStatus: AsyncRequestStatus;
}

interface ActionBarButtonEnabled {
  enabled: boolean;
}

export interface ActionBarButtonState {
  /** "문제 인식하기" */
  recognize: ActionBarButtonEnabled;
  /** "아직 못 풀겠어요"(WORK-4) */
  giveUp: ActionBarButtonEnabled;
  /** "봐 주세요"(SOLVE-2) */
  diagnose: ActionBarButtonEnabled;
}

type SolveStage = "input" | "work" | "result";

function deriveSolveStage(input: ActionBarStateInput): SolveStage {
  if (input.problemId === null) {
    return "input";
  }
  if (input.solveStatus === "success") {
    return "result";
  }
  return "work";
}

const DISABLED_STATE: ActionBarButtonState = {
  recognize: { enabled: false },
  giveUp: { enabled: false },
  diagnose: { enabled: false },
};

/** 단계별 버튼 활성 상태 상태표. INPUT/WORK/RESULT 각 단계에서 어떤 버튼이 활성화 "대상"인지만
 *  결정하고, 로딩 중 여부에 따른 최종 활성화 판단은 `getActionBarState` 본문에서 처리한다. */
export function getActionBarState(input: ActionBarStateInput): ActionBarButtonState {
  const stage = deriveSolveStage(input);
  const isRecognizing = input.recognizeStatus === "loading";
  const isDiagnosing = input.solveStatus === "loading";

  switch (stage) {
    case "input":
      return {
        ...DISABLED_STATE,
        recognize: { enabled: input.hasProblemInput && !isRecognizing },
      };
    case "work":
      return {
        ...DISABLED_STATE,
        giveUp: { enabled: !isDiagnosing },
        diagnose: { enabled: !isDiagnosing },
      };
    case "result":
      return DISABLED_STATE;
    default:
      return DISABLED_STATE;
  }
}
