/**
 * `features/solve-session/ActionBar`(v2.0, "문제 인식하기(또는 새 문제 풀기) / 아직 못 풀겠어요 /
 * 봐 주세요" 3분할)의 버튼별 활성/비활성 상태를 계산하는 순수함수. Figma 문제 인식 스토리보드
 * (`267:778`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`) 실측 결과를 반영한 4단계 상태표를 따른다
 * (`docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7).
 *
 * `shared/`는 어떤 계층(`app`/`pages`/`features`)도 참조하지 않는다(`.claude/rules/frontend.md` §1)
 * — 그래서 `RecognizeStatus`/`SolveStreamStatus`(각각 `features/problem-recognition`,
 * `features/ai-solution` 소유 타입)를 직접 import하지 않고, 동일한 값 집합(`"idle"|"loading"|
 * "success"|"error"`)을 갖는 `AsyncRequestStatus`를 이 파일에서 별도로 정의한다. 두 훅의 상태
 * 값은 구조적으로 동일해 별도 캐스팅 없이 그대로 전달할 수 있다.
 *
 * 세그먼트 자리는 고정 3개([1]=문제 인식하기/새 문제 풀기, [2]=아직 못 풀겠어요, [3]=봐 주세요)이며
 * 자리 교체 없이 라벨/강조/활성 여부만 단계별로 바뀐다. 단계 판별 기준(기존
 * `ProblemInputProvider`/`ProblemInputContext`의 실제 상태 필드 기준):
 * - INPUT(`problemId === null`): 아직 문제가 인식되지 않았다. "문제 인식하기"만 활성화 대상이다.
 * - WORK-풀이전(`problemId !== null`, 결과 없음, `hasWorkInput === false`): WORK 캔버스에 아직
 *   입력이 없다. "아직 못 풀겠어요"만 활성화 대상이고, "봐 주세요"는 비활성이다.
 * - WORK-풀이후(`problemId !== null`, 결과 없음, `hasWorkInput === true`): WORK 캔버스에 입력이
 *   생겼다. "아직 못 풀겠어요"(활성, 비강조)와 "봐 주세요"(활성, 강조) 모두 활성화 대상이다.
 * - RESULT(`solveStatus === "success"` 또는 `diagnoseStatus === "success"`): WORK-4(기존 solve
 *   재사용)와 SOLVE-2(신규 diagnose) 두 경로 중 어느 쪽으로 도달했든 결과가 이미 표시 중이다.
 *   [1] 세그먼트가 "새 문제 풀기"로 라벨이 바뀌며 다시 활성화되고, 나머지 둘은 비활성이다.
 *
 * 두 WORK 서브스테이트 모두에서 recognizeWork/진단 요청이 이미 진행 중이면(`isBusy`) 중복 제출을
 * 막기 위해 "아직 못 풀겠어요"/"봐 주세요" 둘 다 비활성화한다.
 */

export type AsyncRequestStatus = "idle" | "loading" | "success" | "error";

export interface ActionBarStateInput {
  /** recognize 성공 시 채워지는 문제 ID. `null`이면 아직 INPUT 단계다. */
  problemId: string | null;
  /** 사진 또는 필기 입력이 있는지. INPUT 단계에서 "문제 인식하기" 활성화 조건이다. */
  hasProblemInput: boolean;
  /** `useRecognizeProblem().status`와 동일한 값 집합. */
  recognizeStatus: AsyncRequestStatus;
  /** `useSolveStream().status`와 동일한 값 집합(WORK-4 "아직 못 풀겠어요"가 재사용하는 solve). */
  solveStatus: AsyncRequestStatus;
  /** `useRecognizeWork().status`와 동일한 값 집합("봐 주세요" 1단계: 학생 풀이 인식). */
  recognizeWorkStatus: AsyncRequestStatus;
  /** `useDiagnose().status`와 동일한 값 집합("봐 주세요" 2단계: 진단). */
  diagnoseStatus: AsyncRequestStatus;
  /** WORK 캔버스에 입력이 있는지(`workStrokes.length > 0 || workLines !== null`). WORK 단계를
   *  "풀이전"/"풀이후" 두 서브스테이트로 나누는 기준이다. */
  hasWorkInput: boolean;
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

type SolveStage = "input" | "work-notyet" | "work-done" | "result";

function deriveSolveStage(input: ActionBarStateInput): SolveStage {
  if (input.problemId === null) {
    return "input";
  }
  if (input.solveStatus === "success" || input.diagnoseStatus === "success") {
    return "result";
  }
  return input.hasWorkInput ? "work-done" : "work-notyet";
}

const DISABLED_STATE: ActionBarButtonState = {
  recognize: { enabled: false },
  giveUp: { enabled: false },
  diagnose: { enabled: false },
};

/** 단계별 버튼 활성 상태 상태표. INPUT/WORK-풀이전/WORK-풀이후/RESULT 각 단계에서 어떤 버튼이
 *  활성화 "대상"인지만 결정하고, 로딩 중 여부에 따른 최종 활성화 판단은 `getActionBarState` 본문에서
 *  처리한다. */
export function getActionBarState(input: ActionBarStateInput): ActionBarButtonState {
  const stage = deriveSolveStage(input);
  const isRecognizing = input.recognizeStatus === "loading";
  // WORK 단계의 "아직 못 풀겠어요"(solve 재사용)와 "봐 주세요"(recognizeWork → diagnose 2단계) 중
  // 어느 하나라도 진행 중이면 중복 제출을 막기 위해 둘 다 비활성화한다(상호 배제).
  const isBusy =
    input.solveStatus === "loading" ||
    input.recognizeWorkStatus === "loading" ||
    input.diagnoseStatus === "loading";

  switch (stage) {
    case "input":
      return {
        ...DISABLED_STATE,
        recognize: { enabled: input.hasProblemInput && !isRecognizing },
      };
    case "work-notyet":
      return {
        ...DISABLED_STATE,
        giveUp: { enabled: !isBusy },
      };
    case "work-done":
      return {
        ...DISABLED_STATE,
        giveUp: { enabled: !isBusy },
        diagnose: { enabled: !isBusy },
      };
    case "result":
      return {
        ...DISABLED_STATE,
        recognize: { enabled: true },
      };
    default:
      return DISABLED_STATE;
  }
}
