/**
 * CHAT 맥락 구성(Stage 5, 계획 §3.7·S5-D5·S5-D6). 서버 `FIGURES_ENABLED` on일 때만 라우터가 쓴다 — off면 이 파일의
 * 어떤 함수도 호출되지 않아 `adapter.chat` 인자가 기존과 같다.
 */
import type { ChatMessage, FigureSpec, Solution } from "shared-types";
import { buildFigureChatSummaries, splitSolutionSteps } from "validation";
import type { ChatFigureContext } from "../../infrastructure/ai/adapter";

/** history 상한 — 최근 메시지 수. **결정 필요(임시값, S5-D5).** */
export const CHAT_HISTORY_MAX_MESSAGES = 12;
/** history 상한 — 메시지 본문 합계 문자 수. **결정 필요(임시값, S5-D5).** */
export const CHAT_HISTORY_MAX_CHARS = 8_000;
/** 풀이 발췌 문자 수. **결정 필요(임시값, S5-D6).** */
export const CHAT_SOLUTION_EXCERPT_MAX_CHARS = 4_000;
/** 현재 단계 블록 원문 문자 수. **결정 필요(임시값, S5-D6).** */
export const CHAT_STEP_TEXT_MAX_CHARS = 1_000;

/**
 * 최근 12개, 본문 합계 8,000자 이하로 자른다(오래된 것부터 버림, 순서 유지). 가장 최근 메시지 하나만으로 상한을 넘으면
 * 그 메시지 본문의 앞 8,000자만 남긴다. 입력 배열은 바꾸지 않는다.
 */
export function capChatHistory(history: readonly ChatMessage[]): ChatMessage[] {
  const recent = history.slice(-CHAT_HISTORY_MAX_MESSAGES);
  let total = recent.reduce((sum, message) => sum + message.content.length, 0);
  let start = 0;
  while (total > CHAT_HISTORY_MAX_CHARS && start < recent.length - 1) {
    total -= recent[start]?.content.length ?? 0;
    start += 1;
  }
  const kept = recent.slice(start);
  const only = kept[0];
  if (kept.length === 1 && only && only.content.length > CHAT_HISTORY_MAX_CHARS) {
    return [{ role: only.role, content: only.content.slice(0, CHAT_HISTORY_MAX_CHARS) }];
  }
  return kept.map((message) => ({ role: message.role, content: message.content }));
}

/** 검증 도형이 있는 결과의 CHAT 도형 맥락. 도형이 없으면 null(라우터는 키를 넣지 않는다). */
export function buildChatFigureContext(
  solution: Solution,
  figures: readonly FigureSpec[] | undefined,
  step: number | null,
): ChatFigureContext | null {
  if (!figures || figures.length === 0) return null;
  const solutionMd = solution.solutionMd ?? "";
  const split = splitSolutionSteps(solutionMd);
  const block = step !== null && split.ok ? split.steps[step - 1] : undefined;
  return {
    currentStep: step,
    stepText: block ? block.text.slice(0, CHAT_STEP_TEXT_MAX_CHARS) : null,
    solutionExcerpt: solutionMd.slice(0, CHAT_SOLUTION_EXCERPT_MAX_CHARS),
    figures: buildFigureChatSummaries(figures, step),
  };
}
