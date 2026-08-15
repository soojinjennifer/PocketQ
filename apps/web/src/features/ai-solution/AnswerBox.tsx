import { renderMathText } from "./renderMathText";

interface AnswerBoxProps {
  answerMd: string;
}

/**
 * Figma `AnswerBox`(`39:50~39:51`) — "최종 답 · {answerMd}" 형태의 한 줄 강조 배너.
 * `answerMd`가 여러 줄/수식을 포함할 수 있어 한 줄에 억지로 맞추지 않고 자연스럽게 줄바꿈한다.
 */
export function AnswerBox({ answerMd }: AnswerBoxProps) {
  return (
    <div className="bg-fill-tint-brand rounded-[14px] p-4">
      <p className="text-brand-deep text-[15px] leading-[20px] font-[590] whitespace-pre-wrap">
        <span>최종 답 · </span>
        {renderMathText(answerMd)}
      </p>
    </div>
  );
}
