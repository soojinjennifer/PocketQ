import { Badge } from "../../shared/ui/badge/Badge";
import { formatHistoryDate } from "./formatHistoryDate";

interface HistoryRowProps {
  recognizedText: string;
  conceptTags: string[];
  /** ISO 8601 문자열(서버 `createdAt`). */
  createdAt: string;
  onClick: () => void;
}

/**
 * Figma `4 · MyPage` History Row(컴포넌트 `36:2`, 목록 컨테이너 `40:67`) 실측 스타일.
 * 높이 78px, `bg-bg-elevated` + 하단 separator, 좌측 Thumb(72×52) + 문제 텍스트 1줄 truncate +
 * meta 행(개념 태그 chip + 날짜) + 우측 chevron 구성이다.
 *
 * Thumb은 Figma에서도 실제 이미지가 아니라 텍스트 placeholder다 — 원본 사진/필기 이미지 Storage는
 * 이번 범위 밖이므로 `recognizedText`를 작게 넣어 잘라 보여준다. **사진/필기 구분 뱃지는 Figma에
 * 없어 만들지 않는다.**
 *
 * Figma 없음 — 결정 필요:
 * - Thumb 안 텍스트 크기(`text-[11px]`/`leading-[13px]`)와 meta 행 날짜 크기(`text-[12px]`)는
 *   실측값이 없어 chip(12px)과 어울리는 값으로 임시 지정했다.
 * - `conceptTags`가 여러 개일 때 몇 개까지 보일지 정의돼 있지 않다. 78px 고정 높이를 넘기지 않도록
 *   첫 번째 태그만 노출한다(`ResultPanel` 헤더 카테고리 배지가 `conceptTags[0]`만 쓰는 것과 동일).
 * - 목록 마지막 행의 하단 보더(`last:border-b-0`)는 라운드 카드 아래쪽 모서리와 겹쳐 보이지 않도록
 *   제거했다.
 */
export function HistoryRow({ recognizedText, conceptTags, createdAt, onClick }: HistoryRowProps) {
  const primaryTag = conceptTags[0];
  const formattedDate = formatHistoryDate(createdAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-bg-elevated border-separator focus-visible:ring-brand flex h-[78px] w-full items-center gap-[14px] border-b px-[18px] py-[13px] text-left outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset"
    >
      <span
        aria-hidden="true"
        className="bg-bg-canvas border-separator text-label-tertiary flex h-[52px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border px-[6px] text-center text-[11px] leading-[13px] break-all"
      >
        {recognizedText}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <span className="text-label-primary overflow-hidden text-[15px] font-[590] text-ellipsis whitespace-nowrap">
          {recognizedText}
        </span>
        <span className="flex items-center gap-[8px]">
          {primaryTag ? (
            <Badge variant="tint-blue-flat" size="tag-sm">
              {primaryTag}
            </Badge>
          ) : null}
          {formattedDate ? (
            <span className="text-label-secondary text-[12px]">{formattedDate}</span>
          ) : null}
        </span>
      </span>

      <span aria-hidden="true" className="text-label-tertiary shrink-0 text-[20px] font-[590]">
        ›
      </span>
    </button>
  );
}
