import { createContext } from "react";
import type { ChatMessage, Diagnosis, ResumeMode, ResumeSolution, Solution, WorkLine } from "shared-types";
import type { RecognizeStatus } from "../problem-recognition/useRecognizeProblem";
import type { RecognizeWorkInput, RecognizeWorkStatus } from "../problem-recognition/useRecognizeWork";
import type { SolveStreamStatus } from "../ai-solution/useSolveStream";
import type { DiagnoseInput, DiagnoseStatus } from "../ai-solution/useDiagnose";
import type { ResumeStreamStatus } from "../ai-solution/useResumeStream";
import type { ChatStatus } from "../follow-up-chat/useChatMessages";
import type { DrawingTool, Stroke, StrokePoint } from "../../shared/lib/canvas/useDrawingStrokes";

export interface CapturedImage {
  blob: Blob;
  /** `blobToObjectUrl`로 생성한 미리보기 URL. 더 이상 필요 없어지면 반드시 revoke해야 한다. */
  previewUrl: string;
}

export interface ProblemInputContextValue {
  // 사진 입력
  capturedImage: CapturedImage | null;
  /** 촬영/선택된 Blob을 저장한다(내부적으로 이전 previewUrl은 해제하고 새 objectURL을 생성한다). */
  setCapturedImage: (blob: Blob) => void;
  /** 사진 입력만 초기화한다(필기 획은 그대로 둔다). */
  clearCapturedImage: () => void;
  /** 촬영 데이터 보유 여부 — `/camera/preview` 가드에 사용된다. */
  hasCaptureData: boolean;

  // 필기 입력 (기존 `useDrawingStrokes`를 Provider가 한 번만 호출해 소유권을 옮긴 것)
  strokes: Stroke[];
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  startStroke: (point: StrokePoint) => void;
  addPoint: (point: StrokePoint) => void;
  undoStroke: () => void;
  clearStrokes: () => void;

  // WORK 단계(캔버스에 학생 풀이를 쓰는 중) 전용 두 번째 필기 획 인스턴스 — INPUT 단계의
  // `strokes`(문제 사진/필기)와 완전히 독립적이다(`ProblemInputProvider` JSDoc 참고). 페이지는
  // `useDrawingStrokes()`를 직접 호출하지 않고 이 필드만 소비해야 한다(필기 유실 버그 재발 방지).
  workStrokes: Stroke[];
  workTool: DrawingTool;
  setWorkTool: (tool: DrawingTool) => void;
  startWorkStroke: (point: StrokePoint) => void;
  addWorkPoint: (point: StrokePoint) => void;
  undoWorkStroke: () => void;
  clearWorkStrokes: () => void;

  /** 사진 또는 필기 획 중 하나라도 있으면 true. `/solve/*` "풀기" 버튼 활성화 조건에 사용한다. */
  hasProblemInput: boolean;
  /** 마지막으로 제출한 입력이 사진인지 필기인지. 제출 전에는 `null`. 결과 화면의 "다시 풀기 위해
   *  입력 다시 받기" 흐름(`RecognizedProblemBar`의 "수정")이 어느 입력을 초기화할지 판단하는 데
   *  쓴다 — 풀이 성공 시 `capturedImage`는 지워지므로 그것만으로는 모달리티를 알 수 없다. */
  lastInputType: "photo" | "handwriting" | null;
  /** "수정"(다시 입력) 확인 직후 ~ 새 입력 제출 전 사이의 과도기 동안 true. `hasProblemInput`/
   *  `problemId`가 둘 다 비는 이 짧은 구간에도 `RequireProblemInputGuard`가 `/solve/landscape`
   *  접근을 계속 허용하도록 참조한다(아래 `beginReinput` 참고). */
  isRequestingReinput: boolean;
  /** "수정" 확인 시 호출한다 — recognize/solve/chat 상태를 초기화하고 `isRequestingReinput`을
   *  켠다. 새 `submitProblem()`이 시작되면 자동으로 꺼진다. */
  beginReinput: () => void;
  /** RESULT 단계 Action Bar의 "새 문제 풀기"(v2.0 4b) 클릭 시 호출한다. `beginReinput`(같은 문제를
   *  다시 입력받는 "수정" 흐름)과 달리 완전히 새로운 문제를 시작하기 위한 함수다 — 문제/풀이/채팅/
   *  진단/학생풀이인식 상태를 전부 초기화하고, INPUT용 캔버스와 WORK용 캔버스 획도 모두 지운다. */
  startNewProblem: () => void;

  // recognize → solve 제출 오케스트레이션
  recognizeStatus: RecognizeStatus;
  /** recognize 성공 시 채워지는 문제 ID. `follow-up-chat`(`POST /api/problems/:problemId/chat`)이
   *  참조한다. recognize 전/실패 시에는 `null`. */
  problemId: string | null;
  /** recognize 성공 시 채워지는 인식된 문제 원문. `RecognizedProblemBar`(Result Panel) 표시용. */
  recognizedText: string | null;
  /** 소프트 캡(하루 10회, 오너 확정) 안내용 — 서버가 recognize 응답에 실어 보낸 오늘 누적 인식
   *  횟수. 서버가 값을 생략했으면(reopen 재수화, 카운트 조회 실패 등) `null`이다. */
  dailyUsageCount: number | null;
  /** `dailyUsageCount`의 소프트 캡 상한(항상 10, 값이 있을 때만 함께 채워진다). */
  dailyUsageLimit: number | null;
  solveStatus: SolveStreamStatus;
  streamedText: string;
  solveResult: Solution | null;
  /** 후속 질문 제안 pill 문구(Final QA MEDIUM-4) — 풀이 성공 직후 별도 AI 호출로 채워진다. 아직
   *  없거나 요청이 실패하면 `null`(별도 에러 UI 없이 pill 행 자체를 렌더링하지 않는다). */
  suggestedQuestions: string[] | null;
  submitErrorMessage: string | null;
  /** "풀기" 클릭 시 호출한다: 입력 정규화 → recognize → solve를 순서대로 실행한다. */
  submitProblem: () => Promise<void>;
  /** "문제 인식하기"(INPUT 단계) 클릭 시 호출한다: 입력 정규화 → recognize까지만 실행하고
   *  solve(진단)는 호출하지 않는다 — v2.0부터 recognize와 진단이 분리된 별도 단계이기 때문이다.
   *  성공하면 새 `problemId`를, 실패하면 `null`을 반환한다. */
  recognizeOnly: () => Promise<string | null>;
  /** "아직 못 풀겠어요"(WORK-4) 클릭 시 호출한다. `problemId`가 있어야 동작하며, 기존
   *  `submitProblem()`과 동일하게 개념 + 풀이 전체(solve)를 요청한다(전용 힌트 엔드포인트 없음,
   *  오너 확정). 성공 시 사진 Blob 정리 + 제안 질문 요청까지 이어진다. */
  giveUp: () => Promise<void>;
  /** 마이페이지 과거 풀이 다시 풀기 — 사진/필기 없이 저장된 텍스트로 recognize 상태를 재수화한 뒤
   *  곧바로 solve를 실행한다. 풀이까지 성공하면 `true`, 중간에 실패하면 `false`를 반환한다.
   *  실패 시 에러 메시지는 `submitErrorMessage`로 흘러 기존 에러 Modal이 그대로 재사용된다. */
  resumeFromHistory: (historyProblemId: string) => Promise<boolean>;
  /** 마이페이지 History Row "다시풀기" 버튼(마이페이지 개선 4번) 전용. `resumeFromHistory`와 달리
   *  재수화 직후 solve()를 호출하지 않고 WORK 단계(`problemId !== null`)까지만 진입시킨다 — 오너
   *  확정: 인식이 이미 된 것처럼 표시하되 곧바로 학생이 풀 수 있어야 한다. 성공하면 `true`, 실패하면
   *  `false`를 반환한다(실패 시 에러 메시지는 `submitErrorMessage`로 흘러 기존 에러 Modal이 그대로
   *  재사용된다, `resumeFromHistory`와 동일). */
  resumeToWork: (historyProblemId: string) => Promise<boolean>;
  resetSubmission: () => void;

  // 후속 질문(채팅) — `features/follow-up-chat/useChatMessages`를 이 Provider가 한 번만 호출해
  // 소유권을 옮긴 것(필기 획을 `useDrawingStrokes`로 옮긴 것과 동일한 패턴). 새 문제가 시작되면
  // (`clearCapturedImage`/`resetSubmission` 경로) 함께 초기화된다(PRD CHAT-9).
  chatMessages: ChatMessage[];
  chatStatus: ChatStatus;
  chatErrorMessage: string | null;
  /** 빈 질문/전송 중 중복 제출은 내부에서 차단한다. 성공하면 `true`, 실패/차단이면 `false`를
   *  반환한다(호출 측이 입력값을 초기화할지 유지할지 판단할 때 사용). */
  sendChatMessage: (question: string) => Promise<boolean>;
  resetChat: () => void;

  // 학생 풀이 인식/진단(WORK/DIAG) — `features/problem-recognition/useRecognizeWork`,
  // `features/ai-solution/useDiagnose`를 이 Provider가 한 번만 호출해 소유권을 옮긴 것(다른
  // recognize/solve/chat 훅과 동일한 패턴). 4a-1 범위에서는 이 훅들을 어느 화면에도 아직 연결하지
  // 않는다 — 화면 흐름 전환은 4b(다음 단계) 범위다.
  recognizeWorkStatus: RecognizeWorkStatus;
  workLines: WorkLine[] | null;
  recognizeWorkErrorMessage: string | null;
  recognizeWork: (input: RecognizeWorkInput) => Promise<WorkLine[] | null>;
  /** `useRecognizeWork().reset` — 새 문제 인식 시점(예: 다음 WORK 재시도)에 이전 인식 결과를 지운다. */
  resetRecognizeWork: () => void;
  diagnoseStatus: DiagnoseStatus;
  diagnosis: Diagnosis | null;
  diagnoseErrorMessage: string | null;
  /** 성공하면 사진 Blob 참조를 정리한다(`clearCapturedImage()`, 오너 확정 §5) — 페이지가 아니라 이
   *  Provider가 소유한다. */
  diagnose: (input: DiagnoseInput) => Promise<Diagnosis | null>;
  /** `useDiagnose().reset`. */
  resetDiagnose: () => void;

  // 이어풀기(RESUME) — `features/ai-solution/useResumeStream`을 이 Provider가 한 번만 호출해
  // 소유권을 옮긴 것(다른 recognize/solve/chat/diagnose 훅과 동일한 패턴). 진단(diagnose) 성공
  // 시 자동으로 호출되지 않는다 — 사용자가 `ResumeModeBar`의 버튼을 직접 눌러야
  // `startResume()`이 호출된다(오너 확정).
  /** 마지막으로 요청한(또는 요청 중인) 이어풀기 모드. 아직 요청 전이면 `null` — 이 경우 화면은
   *  `ResumeModeBar`의 기본 강조 모드로 `"own"`을 사용한다. */
  resumeMode: ResumeMode | null;
  resumeStatus: ResumeStreamStatus;
  /** `chunk` 이벤트의 delta를 누적한 raw 텍스트(현재 화면은 `resumeSolution`만 사용하지만, 향후
   *  스트리밍 중간 표시가 필요해질 경우를 대비해 노출해 둔다). */
  resumeStreamedText: string;
  resumeSolution: ResumeSolution | null;
  resumeErrorMessage: string | null;
  /** `ResumeModeBar`의 버튼 클릭 시 호출한다 — `problemId`가 없으면 아무 동작도 하지 않는다. */
  startResume: (mode: ResumeMode) => Promise<void>;
  /** `useResumeStream().reset`. 새 문제를 시작하거나(`startNewProblem`) "수정"으로 재입력을
   *  시작할 때(`beginReinput`), WORK로 돌아가 학생 풀이를 고칠 때(`SolveLandscapePage`의
   *  `handleEditWork`) 이전 이어풀기 상태가 남아있지 않도록 함께 호출된다. */
  resetResume: () => void;
}

export const ProblemInputContext = createContext<ProblemInputContextValue | undefined>(undefined);
