import { Badge } from "../../shared/ui/badge/Badge";
import { Button } from "../../shared/ui/button/Button";

interface RecognizedChipProps {
  recognizedText: string;
  /** 확장 상태 여부. 축소 상태(기본)는 배지+한 줄 텍스트, 확장 상태는 세로로 긴 카드로 전환된다. */
  isExpanded: boolean;
  /** 칩 옆 확장/축소 토글 아이콘 클릭 핸들러(오너 확정: 칩 자체 탭이 아니라 별도 버튼). */
  onToggleExpand: () => void;
  /**
   * 이 칩의 유일한 액션 버튼 클릭 핸들러(오너 UX 결정: 상시 배치, `RecognizedChip` 안에 위치).
   * 입력 모달리티에 따라 의미가 다르다 — 사진 입력이면 "인식 취소"(`useProblemInput()`의
   * `cancelRecognition`, 사진/필기 입력을 포함해 완전히 초기화), 필기 입력이면 "인식 수정"
   * (`beginRecognitionEdit`, 필기 획은 보존한 채 INPUT 단계로 되돌림) — 부모가 `inputMode`에 맞춰
   * 알맞은 함수를 전달한다.
   */
  onCancelRecognition: () => void;
  /** 재인식/진단이 로딩 중일 때 버튼을 비활성화한다(오너 확정: 최소 방어). */
  isCancelDisabled: boolean;
  /**
   * 사진 입력일 때만 전달되는 원본 이미지 URL. 값이 있으면 확장 상태에서 이미지를 확대해서
   * 보여주고, 없으면(필기 입력) `recognizedText` 전체를 보여준다.
   */
  imageUrl?: string | null;
  /**
   * 인식 버튼의 라벨/동작 분기용 — 사진이면 "인식 취소", 필기면 "인식 수정"(Figma 플로우 조사,
   * design-agent 2단계 handback). 버튼 크기/스타일/hit-slop은 두 모드 모두 동일하다(라벨 모두
   * 4자, 레이아웃 영향 없음).
   */
  inputMode: "photo" | "handwriting";
}

/**
 * Figma 없음 — 결정 필요: Figma `267:612`(확장 인스턴스 오버라이드) 실측에는 Badge+Summary 텍스트만
 * 있고 확장/축소 토글 아이콘 자체가 없다(오너가 트리거를 "칩 옆 별도 버튼"으로 결정했을 뿐, 그
 * 버튼의 시각 형태는 Figma에 정의돼 있지 않다). 이 chevron은 이 프로젝트에 대응하는 아이콘이 없어
 * 새로 그렸고, 굵기(`strokeWidth`)만 기존 스트로크 기반 아이콘인 `PenRail.tsx`의 `EraseGlyph`(1.35)와
 * 맞춰 일관성을 유지했다 — 정확한 크기/굵기는 실측값이 아니라 근사치이므로 Figma에 이 버튼이
 * 추가되면 재측정이 필요하다.
 */
function ChevronGlyph({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 10 6"
      fill="none"
      className={direction === "up" ? "size-[10px] rotate-180" : "size-[10px]"}
      aria-hidden="true"
    >
      <path
        d="M1 1L5 5L9 1"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CONTAINER_BASE_CLASS_NAME =
  "bg-glass-fill border-glass-border flex rounded-[14px] border drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)] shadow-[inset_0px_2px_0px_rgba(255,255,255,0.6)]";

const RECOGNIZED_TEXT_CLASS_NAME = "text-label-primary text-[13px] leading-[18px] font-normal";

/**
 * Figma `Solve/Recognized Chip`(정식 컴포넌트 `310:1498`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, 접힘
 * 인스턴스 `250:56`/펼침 인스턴스 `310:1499`) — `/solve/pencilcanvas` WORK 단계 캔버스 상단에
 * 인식된 문제 원문을 보여주는 모서리 둥근(`rounded-[14px]`, 오너 결정) 글래스 칩.
 * `features/ai-solution/RecognizedProblemBar`
 * (`/solve/landscape` Result Panel 전용)와 달리 이 칩에는 편집 진입점("수정")이 없다 — 이 화면에는
 * 인식 완료 후 텍스트를 고쳐 재제출하는 흐름이 없기 때문이다.
 *
 * 배경/보더는 `bg-glass-fill`/`border-glass-border`(ActionBar/PenRail과 동일 톤), 그림자는
 * `Elevation/Tab Pill`(2겹, `docs/DESIGN_SYSTEM.md` §4) — ActionBar/PenRail이 쓰는
 * `Elevation/Floating Bar`(3겹+inset)와는 다른 값이니 혼동하지 않는다. 축소 상태의 Summary
 * 텍스트는 1줄 말줄임(ellipsis, 오너 결정)으로 처리하고, 펼침 상태는 줄바꿈을 허용한다.
 *
 * 폭(design-agent 사후검수 수정, Figma MCP `310:1498` 재조회로 확인): 접힘 인스턴스 `250:56`은
 * 400×38, 펼침 인스턴스 `310:1499`는 400×122 — 두 상태 모두 `w-[400px]`가 실측값이다(이전에는
 * 존재하지 않는 다른 노드 `267:607`를 근거로 펼침 상태에 `316px`를 썼고, 접힘 상태는 폭 지정이
 * 아예 없어 `truncate`가 실제로는 아무 폭 제약 없이 콘텐츠 크기에 맞춰 늘어나 1줄 말줄임이 전혀
 * 동작하지 않는 결함이 있었다 — 둘 다 이번에 수정).
 *
 * 높이는 결정 필요: 펼침 인스턴스 `310:1499`의 122px는 6줄짜리 샘플 텍스트를 그대로 담은
 * hug-height 결과일 뿐 Figma가 정의한 최소/고정 높이 스펙이 아니다(패딩 14px×2 + 텍스트
 * 6×18px = 122). 실제 인식 결과 줄 수는 문제마다 다르므로 임의의 최소 높이 값을 새로 만들지 않고
 * 콘텐츠에 맞춰 자연스럽게 늘어나도록(hug) 두었다 — 정확한 최소/최대 높이 규칙이 필요하면 Figma에
 * 별도 스펙 추가 후 재측정해야 한다.
 *
 * 확장 기능(work-order 2차, 오너 확정): 칩 옆 별도 버튼으로 토글한다(칩 자체 탭 아님). 위치는
 * 축소/확장 모두 동일하다 — 화면 상단 중앙(Figma `267:607`/`38:21` 두 프레임 모두 동일 좌표
 * x=400, y=98, 1194×834 프레임 기준, 오너 확정). `SolvePencilcanvasPage`가 항상 화면 상단 중앙의
 * 같은 위치에 이 컴포넌트를 렌더링하고 `isExpanded` prop만 바꾼다.
 */
export function RecognizedChip({
  recognizedText,
  isExpanded,
  onToggleExpand,
  onCancelRecognition,
  isCancelDisabled,
  imageUrl,
  inputMode,
}: RecognizedChipProps) {
  // `max-w-[calc(100vw-32px)]`는 Figma 실측값이 아니라 방어적 안전장치다(design-agent 사후검수
  // 추가) — 좁은 iPad 세로 모드/Split View에서 400px 고정폭이 뷰포트 밖으로 밀려나거나 가로
  // 스크롤을 유발하지 않도록 화면 폭을 넘지 않는 선에서만 축소시킨다. 접힘 상태에도 동일하게
  // 적용한다 — 폭 제약이 전혀 없으면 `truncate`가 걸릴 대상 자체가 없어 1줄 말줄임이 동작하지
  // 않는다(design-agent 사후검수 발견·수정: 이전에는 접힘 상태에 폭 지정이 없었다).
  // 펼침 상태 세로 패딩(design-agent Figma 재실측, `310:1498`): `px-[14px] py-[7px]`가 실측값이다
  // (이전에는 상하좌우 동일한 `p-[14px]`를 썼다 — 좌우는 우연히 일치했지만 세로는 7px 초과였다).
  const containerClassName = isExpanded
    ? `${CONTAINER_BASE_CLASS_NAME} w-[400px] max-w-[calc(100vw-32px)] flex-col gap-[8px] px-[14px] py-[7px]`
    : `${CONTAINER_BASE_CLASS_NAME} w-[400px] max-w-[calc(100vw-32px)] items-center gap-[8px] px-[14px] py-[7px]`;

  return (
    <div className={containerClassName}>
      {/* `items-start`(그리고 배지/토글에 `mt-[1px]`로 첫 줄 텍스트와 시각적 베이스라인을
      맞춤): 실제 인식 결과(특히 수능형 장문 수열/도형 문제)는 여러 줄로 감싸질 수 있는데,
      `items-center`였을 때 배지/토글 버튼이 텍스트 전체 높이의 중앙, 즉 문단 중간 어딘가에
      떠 있는 것처럼 보이는 실측 결함이 있었다(오너 iPad 스크린샷으로 발견). 이 row에는 `w-full`을
      반드시 줘야 한다 — row가 flex item(부모 컨테이너의 유일한 자식)일 때 기본 `flex-grow:0`이라
      `w-full` 없이는 부모의 고정폭(`w-[400px]`)을 채우도록 강제되지 않고 콘텐츠(뱃지+전체 텍스트+
      토글) 크기만큼 늘어날 수 있다 — 안쪽 `<p>`의 `min-w-0 flex-1 truncate`는 "이 row 안에서"
      줄어들 수 있게 할 뿐, row 자체가 무한정 넓어지는 것은 막지 못해 바깥 400px 박스를 넘어 텍스트가
      삐져나가는 결함이 있었다(오너 iPad 실기기 스크린샷 발견, design-agent 코드 추적으로 근본 원인
      확인). */}
      <div className="flex w-full items-start gap-[8px]">
        <div className="mt-[1px]">
          <Badge variant="tint-green" size="recognized-chip">
            인식됨
          </Badge>
        </div>
        {isExpanded ? null : (
          // 축소 상태는 1줄 말줄임(ellipsis) 처리한다(오너 결정, Figma `310:1498` 접힘 인스턴스
          // `250:56`) — `flex-1`과 `min-w-0`을 함께 줘야 flex 자식에서 `truncate`가 정상 동작한다
          // (min-w-0 없이는 flex 기본 min-width:auto 때문에 줄어들지 않고 넘친다).
          <p className={`min-w-0 flex-1 truncate ${RECOGNIZED_TEXT_CLASS_NAME}`}>
            {recognizedText}
          </p>
        )}
        {/* "인식 취소"/"인식 수정" 버튼(오너 UX 결정, Figma `310:1498` 실측: Badge → (접힘 시)
        텍스트 → 이 버튼 → chevron 순서, 88×30 고정 박스). 라벨은 `inputMode`에 따라 분기한다 —
        사진 입력은 "인식 취소"(완전 초기화), 필기 입력은 "인식 수정"(필기 획 보존, Figma 플로우
        조사 완료). `Button`의 `pill-dark` variant(`bg-label-primary
        text-bg-elevated rounded-full`)를 재사용하고 `className`으로 88×30 고정 크기를 강제한다 —
        기본 `PILL_BASE_STYLE`의 `px-[26px] py-[11px]`는 88×30 안에서 텍스트가 넘치므로 `!px-0
        !py-0`으로 함께 덮어써서 `items-center justify-center`(기존 pill 스타일 그대로) 중앙 정렬에
        기댄다(stage-qa-agent 실빌드 CSS+headless Chrome 재현 발견·수정 — `px-0 py-0`만으로는 Tailwind
        v4가 유틸리티를 className 작성 순서가 아니라 canonical 순서로 CSS에 배치해 빌드 산출물에서
        `px-[26px]/py-[11px]`가 동일 specificity에서 나중에 나와 이겼다. `!` important 수식자로
        specificity를 올려 반드시 이기도록 고정한다). 44px 최소 터치 타깃(PRD 접근성 요구)은 시각
        크기(88×30)를 그대로 유지한 채 확보해야
        하므로, 아래 chevron처럼 "보이지 않는 별도 버튼으로 감싸기"가 아니라 이 버튼 자신에
        `relative` + `::before` 가상요소로 상하 7px씩(30+7+7=44) 투명 히트 슬롭을 추가하는 방식을
        쓴다 — `::before`는 배경이 없어 시각적으로 보이지 않지만 클릭 판정 영역에는 포함되고, 실제
        보이는 pill 배경(`bg-label-primary`)은 여전히 88×30 그대로다(로딩 중 비활성화 시각은 `Button`
        pill 계열의 기존 `Style=Disable` 처리를 그대로 재사용). 크기(88×30)만 Figma `310:1498`의
        `Button/Pill` 인스턴스 실측값이고, 그 인스턴스의 실제 텍스트 오버라이드는 "다시 풀기"였다 —
        여기 쓰인 "인식 취소" 문구는 Figma 문구가 아니라 오너 UX 결정이다(크기만 실측, 문구는
        오너 결정). */}
        <Button
          variant="pill-dark"
          onClick={onCancelRecognition}
          disabled={isCancelDisabled}
          className="relative h-[30px] w-[88px] shrink-0 !px-0 !py-0 before:absolute before:-inset-y-[7px] before:inset-x-0 before:content-['']"
        >
          {inputMode === "handwriting" ? "인식 수정" : "인식 취소"}
        </Button>
        {/* 시각적 아이콘 슬롯은 Figma 칩 리듬에 맞춰 18px로 유지하되, 실제 탭 가능 영역은
        `::before` 가상요소로 44px 이상까지 넓힌다(PRD `docs/PRD_WHYMATH.md` §"접근성" 최소 터치
        타깃 44px 요구사항, design-agent 사후검수 발견·수정 — 기존 18px는 이 요구사항 미달이었다).
        바깥 `relative` 래퍼가 레이아웃 공간을 그대로 18px로 유지하므로 칩의 기존 폭/정렬에는
        영향이 없다.
        좌우는 대칭이 아니다(design-agent 사후검수에서 실제 클릭 겹침 버그로 발견·수정) — 왼쪽(인식
        취소 버튼 쪽)은 `gap-[8px]`를 그대로 유지해 인식 취소 버튼의 히트박스(88px 폭, 가로 확장
        없음)를 침범하지 않도록 `-left-[8px]`로 제한하고, 오른쪽(바깥쪽, 침범 대상이 없는 방향)을
        `-right-[19px]`로 더 넓혀 보상한다 — 시각 슬롯 18px + 좌 8px + 우 19px = 45px로 44px 최소
        터치 타깃을 여전히 만족한다(세로는 `-inset-y-[13px]`로 기존과 동일하게 18+13+13=44px 유지,
        문제 없었으므로 그대로 둔다). 이전에는 사방 동일한 `-inset-[13px]`를 썼는데, 왼쪽으로도
        13px 확장되면서 `gap-[8px]`를 5px 초과해 인식 취소 버튼 오른쪽 끝 폭 5px가 실제로는 눌러도
        chevron이 반응하는 죽은 영역이 되는 버그가 있었다(DOM 순서상 chevron이 나중에 렌더링돼
        겹치는 영역에서 클릭을 가로챔). 확장 영역은 실제 `<button>` 자체가 아니라 `::before`
        가상요소로 만든다 — 실제 버튼 박스는 여전히 시각 슬롯과 동일한 18×18을 유지해 내부 아이콘의
        중앙 정렬(시각적 위치)이 좌우 비대칭 확장 때문에 틀어지지 않게 한다(버튼 자체를 비대칭으로
        확장하면 `items-center`가 확장된 박스 기준으로 재중앙정렬되어 아이콘이 오른쪽으로 밀린다). */}
        <div className="relative mt-[1px] flex size-[18px] shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={isExpanded ? "인식된 문제 축소" : "인식된 문제 확대"}
            aria-expanded={isExpanded}
            className="text-label-primary relative flex size-[18px] items-center justify-center before:absolute before:-inset-y-[13px] before:-left-[8px] before:-right-[19px] before:content-['']"
          >
            <ChevronGlyph direction={isExpanded ? "up" : "down"} />
          </button>
        </div>
      </div>
      {isExpanded ? (
        <div className="flex-1 overflow-y-auto">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="촬영한 문제"
              className="h-full w-full object-contain"
            />
          ) : (
            <p className={`whitespace-pre-wrap ${RECOGNIZED_TEXT_CLASS_NAME}`}>{recognizedText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
