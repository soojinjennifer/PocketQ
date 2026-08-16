import { createContext } from "react";
import type { ChatMessage, Solution } from "shared-types";
import type { RecognizeStatus } from "../problem-recognition/useRecognizeProblem";
import type { SolveStreamStatus } from "../ai-solution/useSolveStream";
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

  /** 사진 또는 필기 획 중 하나라도 있으면 true. `/solve/*` "풀기" 버튼 활성화 조건에 사용한다. */
  hasProblemInput: boolean;

  // "풀기" 버튼 옵션(개념설명/풀이) 선택 상태 — pencilcanvas↔landscape 이동 시에도 유지된다.
  selectedOptionIds: ReadonlySet<string>;
  toggleOption: (id: string) => void;

  // recognize → solve 제출 오케스트레이션
  recognizeStatus: RecognizeStatus;
  /** recognize 성공 시 채워지는 문제 ID. `follow-up-chat`(`POST /api/problems/:problemId/chat`)이
   *  참조한다. recognize 전/실패 시에는 `null`. */
  problemId: string | null;
  /** recognize 성공 시 채워지는 인식된 문제 원문. `RecognizedProblemBar`(Result Panel) 표시용. */
  recognizedText: string | null;
  solveStatus: SolveStreamStatus;
  streamedText: string;
  solveResult: Solution | null;
  submitErrorMessage: string | null;
  /** "풀기" 클릭 시 호출한다: 입력 정규화 → recognize → solve를 순서대로 실행한다. */
  submitProblem: () => Promise<void>;
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
}

export const ProblemInputContext = createContext<ProblemInputContextValue | undefined>(undefined);
