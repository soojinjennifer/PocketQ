import { Badge } from "../../shared/ui/badge/Badge";
import { Checkbox } from "../../shared/ui/checkbox/Checkbox";
import { formatHistoryDate } from "./formatHistoryDate";

interface HistoryRowProps {
  problemId: string;
  recognizedText: string;
  conceptTags: string[];
  /** ISO 8601 문자열(서버 `createdAt`). */
  createdAt: string;
  onClick: () => void;
  /** 마이페이지 개선 3번: 일괄 삭제용 선택 상태. 체크박스는 편집모드 진입 없이 항상 노출된다. */
  isSelected: boolean;
  onToggleSelect: (problemId: string) => void;
  /** 마이페이지 개선 4번: "다시풀기" 버튼 클릭 시 호출한다. 상세보기(`onClick`)와 마찬가지로
   *  이 컴포넌트는 API/네비게이션을 직접 다루지 않고 `problemId`만 그대로 상위(`MyPage`)에 넘긴다
   *  (`onToggleSelect`와 동일한 "페이지가 provider/navigate를 소유" 관례). */
  onRetry: (problemId: string) => void;
}

/**
 * Figma `4 · MyPage` History Row(컴포넌트 `36:2`, 목록 컨테이너 `40:67`) 실측 스타일.
 * 높이 78px, `bg-bg-elevated` + 하단 separator, 좌측 Thumb(120×52, 아래 확대 근거 참고) + 문제 텍스트
 * 1줄 truncate + meta 행(개념 태그 chip + 날짜) + 우측 chevron 구성이다.
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
 * - Thumb 폭 `w-[120px]`(마이페이지 개선 1번 항목, 세로 52px는 78px 행 높이 실측과 맞지 않아 유지):
 *   최초 산식은 Figma 프레임 실측 폭 1040px를 그대로 예산으로 썼으나, 이 행은 실제로 그 폭까지
 *   렌더링되지 않는다 — design-agent 사후검수로 정정. 실제 상한은 `pages/mypage/MyPage.tsx`의
 *   `<main class="max-w-[760px] px-6">`이고, 앱 전역 `ViewportGuard`(1024px 미만은 안내
 *   오버레이로 막음, `shared/ui/viewport-guard/ViewportGuard.tsx`)가 공식 지원 범위를 그 이상으로
 *   고정한다. 1024 > 760이므로 지원 범위 안에서 이 행은 항상 `main`의 `max-w-[760px]`(패딩 제외
 *   콘텐츠 폭 712px)로 렌더링되고 그 아래로 줄어들 일이 없다. 712px에서 좌우 패딩(36px)·Thumb-본문·
 *   본문-chevron gap(28px)·chevron(~14px)을 뺀 본문 예산은 약 634px, Thumb 120px를 반영해도
 *   본문은 약 514px로 최소 확보치(200~250px)의 2배 이상 남아 구조적으로 안전하다(이후 항목에서
 *   체크박스 24px+"다시풀기" 버튼 112px+gap 2개 28px가 추가돼도 본문은 약 350px로 여전히 충분).
 *   기존 72px 대비 +48px(약 1.67배)로 확대한 120px는 이 여유 안에서 "명확히 넓어지되" 과하지 않은
 *   값으로 선택했다. 본문 컨테이너는 `flex-1 min-w-0`로 남는 공간을 그대로 채우게 해 Thumb를
 *   고정폭으로 두어도 두 줄로 깨지지 않는다.
 *
 * 마이페이지 개선 3번(일괄 삭제 체크박스, `40:34`/`279:1176` 실측): 행 전체를 `<button>`으로 두면
 * 체크박스(별도 상호작용 요소)가 그 안에 중첩돼 유효하지 않은 HTML(버튼 안 버튼/인터랙티브 요소)이
 * 되므로, 바깥 컨테이너를 `<div>`로 바꾸고 상세보기용 클릭 영역만 안쪽 `<button>`으로 분리했다.
 * 체크박스는 그 바깥의 형제 요소라 클릭이 상세보기 버튼으로 전파될 일이 없지만, 방어적으로
 * `onClick`에서 `stopPropagation`도 함께 건다(구조가 바뀌어도 안전하도록).
 *
 * 마이페이지 개선 4번("다시풀기" 버튼, `40:34`/`279:1176`/`40:45` 실측): 112×30, 배경
 * `label/primary`(`bg-label-primary`, `#232b38`) + 흰 텍스트(`text-bg-elevated`, `#ffffff`),
 * chevron 왼쪽에 위치한다. 체크박스와 같은 이유로 상세보기 `<button>` **안에** 중첩할 수 없어
 * (버튼 안 버튼은 유효하지 않은 HTML) 형제 요소로 분리했다 — 자연히 chevron도 함께 상세보기
 * 버튼 밖으로 빼서 세 형제(상세보기 버튼/다시풀기 버튼/chevron)가 행 컨테이너의 기존
 * `gap-[14px]`를 그대로 공유하도록 했다(chevron 전용 클릭 영역은 이제 없어지지만 원래도 장식용
 * 화살표였을 뿐이라 상세보기는 여전히 좌측 넓은 영역 클릭으로 가능하다). 체크박스와 동일하게
 * `onClick`에서 `stopPropagation`을 걸어 상세보기가 함께 열리지 않게 한다.
 * design-agent 사후검수로 Figma MCP 재조회 확정(fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, 이 버튼의 실제
 * 컴포넌트 인스턴스 `Button/Pill` node `279:990`): 모서리는 `border-radius: 999px`로 `rounded-full`과
 * 동일하고(확정, 기존 추정값 유지), 텍스트는 `SF Pro Semibold`/`font-weight 590`/`font-size 15`/
 * `line-height 20`(Figma 텍스트 스타일 `Subheadline Semibold`) — 기존 `text-[13px]`는 실측 없이
 * 지정한 임시값이라 `text-[15px]`로 정정한다. 버튼 문구도 Figma 실제 텍스트 레이어가 "다시 풀기"
 * (공백 포함)라 그대로 맞춘다(기존 "다시풀기"는 공백 누락).
 */
export function HistoryRow({
  problemId,
  recognizedText,
  conceptTags,
  createdAt,
  onClick,
  isSelected,
  onToggleSelect,
  onRetry,
}: HistoryRowProps) {
  const primaryTag = conceptTags[0];
  const formattedDate = formatHistoryDate(createdAt);

  return (
    <div className="bg-bg-elevated border-separator flex h-[78px] w-full items-center gap-[14px] border-b px-[18px] py-[13px] last:border-b-0">
      <Checkbox
        checked={isSelected}
        onChange={() => onToggleSelect(problemId)}
        onClick={(event) => event.stopPropagation()}
        aria-label={`${recognizedText} 선택`}
      />

      <button
        type="button"
        onClick={onClick}
        className="focus-visible:ring-brand flex h-full min-w-0 flex-1 items-center gap-[14px] text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <span
          aria-hidden="true"
          className="bg-bg-canvas border-separator text-label-tertiary flex h-[52px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border px-[6px] text-center text-[11px] leading-[13px] break-all"
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
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRetry(problemId);
        }}
        // 상세보기 오버레이(`HistoryDetailPanel`)에도 동일한 "다시 풀기" 라벨의 버튼이 있어(MyPage.tsx
        // `ResultPanel`의 `editLabel`), 이 행이 목록에 있는 동안 오버레이가 열리면 화면에 같은
        // 접근성 이름의 버튼이 둘 존재하게 된다 — 문제 텍스트를 붙여 스크린리더가 구분할 수 있게 한다.
        // 상세보기 버튼(`aria-label`이 사실상 `recognizedText`로 시작)과 접두어가 겹치지 않도록
        // "다시 풀기"를 앞에 둔다(체크박스의 `${recognizedText} 선택`과는 반대 순서, 의도적).
        aria-label={`다시 풀기 ${recognizedText}`}
        className="bg-label-primary text-bg-elevated flex h-[30px] w-[112px] shrink-0 items-center justify-center rounded-full text-[15px] font-[590]"
      >
        다시 풀기
      </button>

      <span aria-hidden="true" className="text-label-tertiary shrink-0 text-[20px] font-[590]">
        ›
      </span>
    </div>
  );
}
