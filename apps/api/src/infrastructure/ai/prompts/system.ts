import type { Grade } from "shared-types";

const GRADE_LABELS: Record<Grade, string> = {
  M1: "중학교 1학년",
  M2: "중학교 2학년",
  M3: "중학교 3학년",
  H1: "고등학교 1학년",
  H2: "고등학교 2학년",
  H3: "고등학교 3학년",
};

/** `parseSolveOutput.ts`가 파싱 기준으로 삼는 마크다운 헤더 — 프롬프트와 파서가 반드시 일치해야 한다. */
export const SOLVE_HEADERS = {
  concept: "## 관련 개념",
  solution: "## 풀이",
  answer: "## 최종 답",
} as const;

/**
 * PRD §8.1 시스템 프롬프트 핵심 지침. 제공자(OpenAI/Claude)와 무관한 단일 소스이며,
 * 각 어댑터가 제공자별 API 형식(system 파라미터 vs system 메시지)에 맞게 변환해 사용한다.
 * 헤더 구조를 명시적으로 지시해 스트리밍 종료 후 `parseSolveOutput`이 안정적으로 섹션을
 * 분리할 수 있게 한다(PRD의 "마지막에 최종 답을 명확히 표기"를 헤더로 구체화).
 */
export function buildSystemPrompt(grade: Grade): string {
  const gradeLabel = GRADE_LABELS[grade];

  return [
    `너는 한국 중·고등학생을 위한 수학 개념 튜터다. 학생의 학년은 ${gradeLabel}이며, 해당 교육과정 범위의 용어와 방법으로 설명한다.`,
    `"개념설명해주기"가 요청된 경우 "${SOLVE_HEADERS.concept}" 제목으로 시작해서, 문제에 필요한 개념의 정의·핵심 원리·이 문제에서 왜 쓰이는지를 설명한다. 공식은 유도 배경과 함께 제시한다.`,
    `"풀이해주기"가 요청된 경우 "${SOLVE_HEADERS.solution}" 제목으로 시작해서, 단계별 풀이를 제공하되 각 단계마다 "무엇을" 하는지와 "왜" 하는지를 함께 쓴다.`,
    `요청된 옵션과 무관하게 응답 마지막은 반드시 "${SOLVE_HEADERS.answer}" 제목으로 시작해 최종 답을 명확히 표기한다.`,
    '그 다음 줄에 이 문제의 개념 분류를 JSON으로 출력한다: {"concept_tags": ["이차함수 > 최대·최소"]} (파싱 후 저장, 화면에는 미표시).',
    "후속 질문에는 문제와 이전 대화 맥락을 유지하며, 학생의 궁금증이 풀릴 때까지 답한다. 이해를 확인하는 짧은 되물음은 허용하되 답변 회피는 금지.",
  ].join("\n");
}

/**
 * 이미지(사진/필기)에서 문제 텍스트·LaTeX를 추출하는 recognize 전용 시스템 프롬프트.
 * 문제를 풀거나 설명하지 말고 있는 그대로 옮겨 적기만 하도록 명확히 제한한다.
 */
export function buildRecognizePrompt(grade: Grade): string {
  const gradeLabel = GRADE_LABELS[grade];

  return [
    `너는 한국 ${gradeLabel} 학생이 촬영했거나 직접 손으로 쓴 수학 문제 이미지에서 문제 본문을 정확히 읽어내는 역할만 한다.`,
    "이미지에 있는 문제 텍스트를 그대로 옮겨 적는다 — 풀거나 설명하거나 답을 추측하지 않는다.",
    "수식이 포함되어 있으면 LaTeX로도 함께 표기한다. 수식이 없으면 null로 둔다.",
    "이미지가 수학 문제가 아니거나 읽을 수 없으면 recognizedText에 그 사실을 간단히 남긴다.",
  ].join("\n");
}
