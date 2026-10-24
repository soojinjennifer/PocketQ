/**
 * 하위 호환 fixture L01~L03 — 도형 기능 이전의(figures 키가 없는) 응답·저장 데이터.
 * 새 스키마로 파싱한 결과가 입력과 deep-equal이어야 한다(키 추가·제거·값 변형 없음).
 */
import type { LegacyFixture } from "./types";

/** L01 figures 없는 Solution(SSE `done` payload). */
export const L01_SOLUTION_WITHOUT_FIGURES: LegacyFixture = {
  id: "L01",
  title: "figures 없는 Solution",
  raw: {
    conceptMd: "이차함수의 표준형",
    solutionMd: "1. 완전제곱식으로 변형합니다.\n2. 꼭짓점의 좌표를 구합니다.",
    answerMd: "최솟값은 -1입니다.",
    conceptTags: ["이차함수", "최대·최소"],
    aiProvider: "openai",
    aiModel: "gpt-5",
  },
};

/** L02 figures 없는 ProblemHistoryDetail(`GET /api/problems/:problemId`). */
export const L02_HISTORY_DETAIL_WITHOUT_FIGURES: LegacyFixture = {
  id: "L02",
  title: "figures 없는 ProblemHistoryDetail",
  raw: {
    problemId: "problem-legacy-1",
    recognizedText: "x^2 - 4x + 3의 최솟값을 구하여라",
    recognizedLatex: "x^2 - 4x + 3",
    createdAt: "2026-09-01T10:00:00.000Z",
    solution: {
      conceptMd: null,
      solutionMd: "완전제곱식으로 변형하면 (x-2)^2 - 1",
      answerMd: "-1",
      conceptTags: ["이차함수"],
      aiProvider: "openai",
      aiModel: "gpt-5",
    },
    chatMessages: [{ role: "user", content: "왜 x=2일 때 최소예요?", createdAt: "2026-09-01T10:01:00.000Z" }],
  },
};

/** L03 figures 없는 ResumeSolution(이어풀기 SSE `done` payload). */
export const L03_RESUME_SOLUTION_WITHOUT_FIGURES: LegacyFixture = {
  id: "L03",
  title: "figures 없는 ResumeSolution",
  raw: {
    mode: "own",
    methodName: "3번째 줄부터 이어가기",
    solutionMd: "## 이어풀기\n3번째 줄부터 이어서 진행합니다.",
    answerMd: "-1",
    verified: true,
  },
};
