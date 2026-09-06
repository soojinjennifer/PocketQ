import { renderMathText } from "../../shared/lib/katex/renderMathText";

type ResultCardKind = "concept" | "steps";

interface ResultCardProps {
  kind: ResultCardKind;
  /** 라벨(캡션)과 본문 사이에 렌더링할 제목(예: "#개념설명" 토글로 나타나는 관련 개념 카드).
   *  전달하지 않으면 기존처럼 라벨 다음 바로 본문이 온다(기존 2개 호출부는 이 prop을 전달하지
   *  않으므로 레이아웃이 그대로 유지된다). */
  title?: string;
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
 * 라벨(캡션, Figma 실측 Caption Semibold 12/16/590, purple/orange 강조색) + 선택적 제목(`title`,
 * 15px/20/590) + 본문 3단 구조. `Solution`(`conceptMd`/`solutionMd`)은 본문 텍스트뿐이라 이 두
 * 호출부는 `title`을 전달하지 않아 기존 2단 레이아웃 그대로 유지된다. `title`은 `Diagnosis.
 * conceptExplanations`(2차 실행, "#개념설명" 토글 카드)처럼 제목이 실제로 있는 데이터에서만
 * 사용한다. 콘텐츠 길이에 따라 자연스럽게 늘어나야 하므로 고정 높이를 주지 않는다(overflow는
 * Body 스크롤에 위임).
 */
export function ResultCard({ kind, title, body }: ResultCardProps) {
  return (
    <div className="bg-bg-elevated flex flex-col gap-2 rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]">
      <p className={`text-[12px] leading-[16px] font-[590] ${LABEL_COLOR[kind]}`}>{LABEL_TEXT[kind]}</p>
      {title ? <p className="text-label-primary text-[15px] leading-[20px] font-[590]">{title}</p> : null}
      <p className="text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
        {renderMathText(body)}
      </p>
    </div>
  );
}
