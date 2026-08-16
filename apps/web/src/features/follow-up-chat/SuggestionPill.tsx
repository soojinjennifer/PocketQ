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
 * 클릭하면 입력창에 문구를 채우고 포커스만 이동시킨다 — 자동 전송은 하지 않는다(오너 확정
 * 인터랙션: pill 클릭 → 입력창 채움 → 포커스 → 사용자가 확인/수정 후 전송 버튼/Enter로만 제출).
 * 실제 채움/포커스/전송 로직은 상위 `ChatFooter`가 담당하고, 이 컴포넌트는 클릭 이벤트만 위임한다.
 */
export function SuggestionPill({ label, onClick }: SuggestionPillProps) {
  return (
    <Badge variant="outline" size="footnote" onClick={onClick}>
      {label}
    </Badge>
  );
}
