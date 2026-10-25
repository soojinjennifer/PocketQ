import { LandingBadge } from "./LandingBadge";
import { LandingButton } from "./LandingButton";
import { SectionHeader } from "./SectionHeader";
import { LANDING_BODY_L, LANDING_CANVAS_SURFACE, LANDING_CONTAINER } from "./landingStyles";

const HASHTAGS = ["#개념설명", "#이차함수 최대·최소", "#비슷한 문제"] as const;

interface WorkLine {
  index: number;
  text: string;
  stuck: boolean;
}

const WORK_LINES: readonly WorkLine[] = [
  { index: 1, text: "D = b² − 4ac 를 이용하자.", stuck: false },
  { index: 2, text: "a = −2, b = 4, c = 1 → D = 24", stuck: false },
  { index: 3, text: "D ≥ 0 이므로 최댓값이 존재한다.", stuck: true },
];

/** Figma `Landing/Work Line`(`445:12`) OK / Stuck. Stuck 행은 `status/error-row` 배경, radius 8. */
function DemoWorkLine({ line }: { line: WorkLine }) {
  const rowStyle = line.stuck ? "bg-landing-status-error-row rounded-landing-icon-sm" : "";
  return (
    <li className={`flex items-center gap-2.5 px-1.5 py-1 ${rowStyle}`}>
      <span className="text-landing-label-ink w-3 shrink-0 text-xs">{line.index}</span>
      <span className="font-landing-math text-landing-brand-deep min-w-0 flex-1 text-sm leading-normal">{line.text}</span>
      {line.stuck ? (
        <LandingBadge variant="error-s">막힌 지점</LandingBadge>
      ) : (
        <LandingBadge variant="tint-s">확인</LandingBadge>
      )}
    </li>
  );
}

/** 진단 결과 카드(일러스트 — 버튼·배지는 상호작용하지 않는다, §7). p 22, radius 30, Shadow Raised, 세로 gap 12. */
function DiagnosisCard() {
  return (
    <div
      role="img"
      aria-label="진단 예시: 1·2번째 줄은 확인, 3번째 줄에서 막힘. a의 부호를 확인해 보도록 안내"
      className={`${LANDING_CANVAS_SURFACE} rounded-landing-panel shadow-landing-raised w-full p-4 md:p-[22px] lg:max-w-[567px] lg:flex-1`}
    >
      <div aria-hidden="true" className="flex flex-col gap-3">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <LandingBadge variant="tag">인식된 문제</LandingBadge>
          <span className="font-landing-math text-landing-brand-deep text-sm leading-normal">y = −2x² + 4x + 1 의 최댓값</span>
        </p>
        <ul className="bg-surface-well rounded-landing-chip m-0 flex list-none flex-col gap-[7px] px-3.5 py-3">
          {WORK_LINES.map((line) => (
            <DemoWorkLine key={line.index} line={line} />
          ))}
        </ul>
        <p className="bg-landing-brand-tint rounded-landing-chip shadow-landing-rest text-landing-brand-deep m-0 px-[15px] py-[13px] text-sm leading-[1.55] md:text-[14.5px]">
          <strong className="font-bold">풀이 진단</strong> · 2번째 줄까지 정확해요. 3번째 줄에서 최댓값의 조건을
          판별식으로 착각했어요 — <strong className="font-bold">a의 부호</strong>를 확인해 볼까요?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <LandingButton as="span" variant="primary-block">
            내 방법으로 계속
          </LandingButton>
          <LandingButton as="span" variant="secondary-block">
            다른 방법으로
          </LandingButton>
        </div>
      </div>
    </div>
  );
}

/** Demo · 진단 결과(`447:91`). 1024 이상 2열, 그 아래 카피 → 카드 1열(§6.2 잠정). */
export function DemoSection() {
  return (
    <section aria-labelledby="demo-title">
      <div className={`${LANDING_CONTAINER} flex flex-col gap-10 pt-14 pb-12 lg:flex-row lg:items-center lg:gap-11 lg:pt-20 lg:pb-16`}>
        <div className="flex min-w-0 flex-col gap-4 lg:max-w-[521px] lg:flex-1">
          <SectionHeader
            titleId="demo-title"
            eyebrow="진단 결과는 이렇게"
            title={
              <>
                처음부터 다시?
                <br />
                아니요, 막힌 곳부터.
              </>
            }
          />
          <p className={`text-landing-label-ink m-0 ${LANDING_BODY_L}`}>
            이미 맞게 쓴 줄은 다시 설명하지 않아요. 내 방법으로 계속 풀거나, 학년 범위 안의 다른 해법을 비교해서
            골라요. 그래도 궁금하면 “왜?”를 몇 번이든 물어보세요.
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {HASHTAGS.map((tag) => (
              <li key={tag}>
                <LandingBadge variant="outline-l">{tag}</LandingBadge>
              </li>
            ))}
          </ul>
        </div>
        <DiagnosisCard />
      </div>
    </section>
  );
}
