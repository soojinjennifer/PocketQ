import type { FigureSpec, Grade, RecognizedProblem, ResumeSolution, Solution, StepFigureRef } from "shared-types";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors/AppError";
import { inMemoryProblemStore } from "./inMemoryProblemStore";

export interface ResolvedSolutionContext {
  problem: RecognizedProblem;
  solution: Solution;
  grade: Grade;
  /** 대화 맥락이 된 결과(Stage 5). solve 풀이가 있으면 "solve", 이어풀기 결과만 있으면 "resume". */
  solutionSource: "solve" | "resume";
  /**
   * 그 결과의 도형 단계에서 검증을 통과해 SSE로 보낸 도형(Stage 5, 서버 메모리). 없으면 키 자체가 없다.
   * 클라이언트가 보낸 도형은 받지 않는다 — CHAT 맥락은 항상 이 값만 쓴다.
   */
  figures?: FigureSpec[];
  stepFigureRefs?: StepFigureRef[];
}

/**
 * 이어풀기 결과(`ResumeSolution`)를 chat/suggestions 어댑터가 받는 `Solution` 모양으로 변환한다.
 * `conceptMd`/`conceptTags`는 이어풀기 결과에 없으므로 빈 값으로 둔다.
 * `aiProvider`/`aiModel`은 어떤 프롬프트나 저장 경로에서도 읽지 않는 자리채움 값이다 —
 * `Solution` 타입을 만족시키기 위해서만 채운다.
 */
function toSolutionFromResume(resumeSolution: ResumeSolution): Solution {
  return {
    conceptMd: null,
    solutionMd: resumeSolution.solutionMd,
    answerMd: resumeSolution.answerMd,
    conceptTags: [],
    aiProvider: env.aiProvider ?? "openai",
    aiModel: env.aiModel,
  };
}

/**
 * `problemId`로 저장소에서 문제/풀이 컨텍스트를 조회한다(chat·suggestions 공용).
 *
 * 검사 순서:
 * 1. 문제 자체가 없거나(잘못된 problemId) 다른 사용자 소유면 동일하게 404.
 *    소유권 검증은 Final QA(BLOCKER-1) 지적 반영 — 없으면 다른 사용자의 problemId로 그 사람의
 *    대화 기록에 메시지를 끼워넣을 수 있었다.
 * 2. `solve`가 채운 최초 풀이(`solution`)가 있으면 그것을 우선 사용한다 — AI가 처음부터 끝까지
 *    푼 완결된 풀이이고, 개념 설명·개념 태그까지 포함해 대화 컨텍스트가 가장 풍부하다.
 * 3. 최초 풀이가 없고 "내 방법"(work → diagnose → resume) 흐름의 이어풀기 결과(`resumeSolution`)만
 *    있으면 이를 `Solution` 모양으로 변환해 사용한다. resume 흐름은 `solution`을 채우지 않으므로,
 *    이 분기가 없으면 이어풀기를 끝낸 뒤의 채팅/질문 추천이 항상 400으로 막힌다.
 *    CAS 검증 통과 여부(`verified`)와 무관하게 사용한다 — 학생에게는 이미 결과 카드로 보여진 풀이다.
 * 4. 둘 다 없으면(예: 풀이 진행 전에 chat을 먼저 호출) 404와 구분해 400을 던진다.
 *
 * Stage 5: 고른 결과에 연결된 검증 도형(`attachSolutionFigures`/`attachResumeFigures`)이 있으면 `figures`·`stepFigureRefs`를
 * 함께 돌려준다(없으면 키 없음). `solution` 객체에는 넣지 않는다 — 도형 플래그 off면 `adapter.chat` 인자가 기존과 같다.
 */
export function resolveSolutionContext(problemId: string, userId: string): ResolvedSolutionContext {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored || stored.userId !== userId) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  if (stored.solution) {
    return {
      problem: stored.problem,
      solution: stored.solution,
      grade: stored.grade,
      solutionSource: "solve",
      ...inMemoryProblemStore.getSolutionFigures(problemId),
    };
  }

  if (stored.resumeSolution) {
    return {
      problem: stored.problem,
      solution: toSolutionFromResume(stored.resumeSolution),
      grade: stored.grade,
      solutionSource: "resume",
      // 이어풀기 결과의 도형도 함께 옮긴다(S5-7) — `Solution` 모양 변환과 별개로, 그 결과에 연결된 도형만.
      ...inMemoryProblemStore.getResumeFigures(problemId),
    };
  }

  throw new AppError(
    "validation_error",
    `문제(${problemId})의 풀이가 아직 없습니다. 먼저 풀이를 완료해주세요.`,
    400,
  );
}
