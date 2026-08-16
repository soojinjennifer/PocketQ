import { renderMathText } from "../../shared/lib/katex/renderMathText";

type ResultCardKind = "concept" | "steps";

interface ResultCardProps {
  kind: ResultCardKind;
  body: string;
}

const LABEL_TEXT: Record<ResultCardKind, string> = {
  concept: "관련 개념",
  steps: "단계별 풀이",
};

// `accent/purple`(#9a93b0)/`accent/orange`(#d9a05b) — tokens.css에 `bg-*`/`text-*` 형태로만
// 노출돼 있어 그대로 재사용한다(신규 색상 아님).
const LABEL_COLOR: Record<ResultCardKind, string> = {
  concept: "text-accent-purple",
  steps: "text-accent-orange",
};

/**
 * Figma `Result Card`(`39:42` concept / `39:46` steps variant, `docs/COMPONENT_MAP.md` §1) —
 * "제목" variant는 없다(concept/steps 2개뿐). `Solution` 타입(`packages/shared-types`)에는
 * 카드 제목에 대응하는 별도 필드가 없어(`conceptMd`/`solutionMd`는 본문 텍스트뿐), 라벨(캡션)만
 * Figma 실측 타이포그래피(Caption Semibold 12/16, 590)로 렌더링하고 색상은 라벨의 강조색
 * (purple/orange)을 유지한다. 제목 필드는 백엔드 스키마 변경이 필요해 다음 단계로 분리(오너
 * 확인) — 이번 라운드는 라벨을 "제목처럼 부풀리지 않고" 실측 크기로 축소하는 것만 반영한다.
 * 콘텐츠 길이에 따라 자연스럽게 늘어나야 하므로 고정 높이를 주지 않는다(overflow는 Body 스크롤에
 * 위임).
 */
export function ResultCard({ kind, body }: ResultCardProps) {
  return (
    <div className="bg-bg-elevated flex flex-col gap-2 rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]">
      <p className={`text-[12px] leading-[16px] font-[590] ${LABEL_COLOR[kind]}`}>{LABEL_TEXT[kind]}</p>
      <p className="text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
        {renderMathText(body)}
      </p>
    </div>
  );
}
