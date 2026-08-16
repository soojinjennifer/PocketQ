import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Badge } from "../../shared/ui/badge/Badge";
import type { ChatStatus } from "./useChatMessages";

export interface ChatFooterHandle {
  /** 입력창에 문구를 채우고 포커스를 옮긴다. 자동 전송은 하지 않는다(오너 확정: pill 클릭 →
   *  채움 → 포커스 → 사용자 확인/수정 → 전송 버튼/Enter로만 제출). `SuggestionPill`은
   *  `features/ai-solution`(`ResultPanel`)이 아니라 페이지 레이어(`SolveLandscapePage`)에서
   *  이 핸들을 통해 호출한다 — `ResultPanel`이 다른 feature(`follow-up-chat`)를 직접 import하지
   *  않게 하기 위한 구조다(`.claude/rules/frontend.md` §1). */
  fillAndFocus: (text: string) => void;
}

interface ChatFooterProps {
  /** 해시태그 pill에 표시할 라벨(예: 문제의 `conceptTags`). `#` 접두사는 이 컴포넌트가 붙인다.
   *  비어 있으면 pill 행 자체를 렌더링하지 않는다. */
  hashtags: string[];
  status: ChatStatus;
  errorMessage: string | null;
  /** 성공하면 `true`, 실패/차단(빈 질문 등)이면 `false`를 반환한다 — 성공 시에만 입력값을
   *  초기화한다(`useChatMessages.sendMessage`를 그대로 전달). */
  onSend: (question: string) => Promise<boolean>;
  /** 해시태그 pill 클릭 핸들러(오너 확정: `SuggestionPill`과 동일하게 입력창을 채우고 포커스만
   *  한다, 자동 전송 없음 — 실제 호출은 페이지 레이어가 `ChatFooterHandle.fillAndFocus`로 처리).
   *  전달하지 않으면 해시태그 pill은 기존처럼 클릭 불가능한 정적 표시로 렌더링된다. */
  onHashtagClick?: (tag: string) => void;
}

/**
 * Figma `174:626`/`174:627`(입력창) + `97:253`(전송 버튼) + `174:618~625`(해시태그 pill) 실측 —
 * Result Panel Body 하단에 고정되는 후속 질문 입력 Footer 전체 셸(`docs/COMPONENT_MAP.md`
 * "후속 질문 입력 영역" 항목).
 *
 * 입력창(`bg-elevated`, `rounded-full`, `pl-[16px] pr-[6px] py-[6px]`, Elevation/Card 그림자
 * 재사용)의 focus 상태/최대 길이/멀티라인은 Figma에 근거가 없어 합리적 기본값을 사용한다(결정
 * 필요, 오너 확인 필요): 단일 라인 입력, `maxLength={2000}`(백엔드 `chatRequestSchema`의
 * `question.max(2000)`과 맞춤).
 *
 * 전송 버튼(32×32 원형, `bg-brand`, "↑" 글리프)의 disabled 스타일은 Figma에 근거가 없어 합리적
 * 기본값을 사용한다(결정 필요, 오너 확인 필요): `disabled:opacity-50 disabled:pointer-events-none`.
 */
export const ChatFooter = forwardRef<ChatFooterHandle, ChatFooterProps>(function ChatFooter(
  { hashtags, status, errorMessage, onSend, onHashtagClick },
  ref,
) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    fillAndFocus: (text: string) => {
      setValue(text);
      inputRef.current?.focus();
    },
  }));

  const isSubmitting = status === "submitting";
  const canSend = value.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSend) {
      return;
    }
    const succeeded = await onSend(value);
    if (succeeded) {
      setValue("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {hashtags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {hashtags.map((tag) => (
            <Badge
              key={tag}
              variant="tint-blue"
              size="tag"
              onClick={onHashtagClick ? () => onHashtagClick(tag) : undefined}
            >
              #{tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="bg-bg-elevated flex items-center gap-2 rounded-full py-[6px] pr-[6px] pl-[16px] drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="궁금증이 풀릴 때까지 물어보세요"
          maxLength={2000}
          disabled={isSubmitting}
          aria-label="후속 질문 입력"
          className="text-label-primary placeholder:text-label-tertiary min-w-0 flex-1 border-0 bg-transparent text-[13px] leading-[18px] font-normal outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSend}
          aria-label="질문 보내기"
          className="bg-brand text-bg-elevated flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] leading-[20px] font-[590] disabled:pointer-events-none disabled:opacity-50"
        >
          ↑
        </button>
      </div>

      {errorMessage ? <p className="text-accent-orange text-[12px] leading-[16px]">{errorMessage}</p> : null}
    </div>
  );
});
