import { Badge } from "../../shared/ui/badge/Badge";

interface SuggestionPillProps {
  label: string;
  onClick: () => void;
}

/**
 * Figma 제안 질문 pill(`174:614`) — Result Panel **Body 최하단**에 위치하는 요소다(Footer의
 * 해시태그 pill과는 다른 요소, 혼동 금지). `Badge`의 `variant="outline"`/`size="footnote"`
 * (배경 없음, `border-brand` 보더/텍스트, 13px/590)를 그대로 재사용한다.
 *
 * 클릭 시 동작은 `onClick`을 넘기는 쪽(`pages/solve/landscape/SolveLandscapePage`)이 결정한다 —
 * 이 컴포넌트 자체는 클릭 이벤트만 위임하고 채움/포커스/전송 로직을 갖지 않는다. 오너 요청
 * (2026-09)에 따라 현재 호출부는 클릭 즉시 질문을 전송한다(`sendChatMessage`) — 과거에는
 * `ChatFooter` 입력창을 채우고 포커스만 주는 동작이었다.
 */
export function SuggestionPill({ label, onClick }: SuggestionPillProps) {
  return (
    <Badge variant="outline" size="footnote" onClick={onClick}>
      {label}
    </Badge>
  );
}
