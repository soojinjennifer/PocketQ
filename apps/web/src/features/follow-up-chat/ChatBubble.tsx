import type { ChatRole } from "shared-types";
import { renderMathText } from "../../shared/lib/katex/renderMathText";

interface ChatBubbleProps {
  role: ChatRole;
  content: string;
}

/**
 * Figma 미확정 임시 컴포넌트 — 정식 Chat Bubble 디자인이 Figma에 추가되면 교체 필요.
 *
 * `docs/DESIGN_COMPONENT.md`/`docs/COMPONENT_MAP.md` §3에 "Chat Bubble"이 등장하지만, 조사
 * 대상 6개 화면(빈 상태 스냅샷)에서는 실제 인스턴스가 확인되지 않아 최종 Variant 구현이
 * 보류되어 있었다(2026-07-29). design-agent가 이번에도 광범위하게 탐색했으나 대화가 진행된
 * 상태의 프레임을 찾지 못했고, 오너가 "임시 버블로 우선 구현, 추후 Figma 확정 시 교체"를
 * 명시적으로 승인했다(2026-08-16).
 *
 * 새 색상을 발명하지 않고 기존 디자인 토큰만 재사용한다: 사용자 질문은 우측 정렬 +
 * `bg-fill-tint-brand`(해시태그 pill과 동일 톤)의 좁은 버블. AI 답변은 `ResultCard`/`AnswerBox`와
 * 동일하게 패널 폭을 꽉 채우는 카드(`bg-bg-elevated` + Elevation/Card 그림자)로 렌더링한다 —
 * 처음엔 답변도 좁은 버블(`max-w-[85%]`)이었으나, Result Panel을 Extend(748px)로 넓히면 짧은
 * 답변 옆에 큰 빈 여백이 남아 위의 ResultCard/AnswerBox만 넓어지고 답변만 안 넓어지는 것처럼
 * 보이는 문제가 있어(오너 리포트, 2026-08-16) 다른 카드들과 동일한 폭 규칙으로 통일했다. KaTeX는
 * 기존 `shared/lib/katex/renderMathText`를 그대로 import해서 쓴다(신규 렌더링 유틸 금지, 내부
 * 로직 수정 금지).
 */
export function ChatBubble({ role, content }: ChatBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-fill-tint-brand max-w-[85%] rounded-[14px] p-3">
          <p className="text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
            {renderMathText(content)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-elevated rounded-[14px] p-3 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]">
      <p className="text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
        {renderMathText(content)}
      </p>
    </div>
  );
}
