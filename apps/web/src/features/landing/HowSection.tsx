import type { ReactNode } from "react";
import { LandingBadge } from "./LandingBadge";
import { LandingButton } from "./LandingButton";
import { SectionHeader } from "./SectionHeader";
import {
  LANDING_CANVAS_SURFACE,
  LANDING_CONTAINER,
  LANDING_PRIMARY_SURFACE,
  LANDING_SCROLL_MARGIN,
} from "./landingStyles";

interface StepCardProps {
  number: number;
  badge: string;
  title: ReactNode;
  body: string;
  /** 하단 정적 일러스트(상호작용 없음, §7). */
  illustration: ReactNode;
  illustrationLabel: string;
}

/**
 * Figma `Landing/Step Card`(`445:43`): p 26, radius 28, Shadow Rest, 세로 gap 14. 1024 이상 높이 315.
 * 큰 번호는 `<ol>`이 순서를 전달하므로 장식(`aria-hidden`)이고, 대비를 위해 `brand/mint` 대신 `brand/green`을 쓴다(D-16).
 */
function StepCard({ number, badge, title, body, illustration, illustrationLabel }: StepCardProps) {
  return (
    <li
      className={`${LANDING_CANVAS_SURFACE} rounded-landing-card shadow-landing-rest flex flex-col gap-3.5 p-6 lg:min-h-[315px] lg:p-[26px]`}
    >
      <div className="flex items-start justify-between">
        <span aria-hidden="true" className="text-landing-brand-green text-[44px] leading-none font-extrabold">
          {number}
        </span>
        <LandingBadge variant="tint-m">{badge}</LandingBadge>
      </div>
      <h3 className="text-landing-brand-deep m-0 text-[21px] leading-[1.2] font-bold text-balance">{title}</h3>
      <p className="text-landing-label-ink m-0 text-[15px] leading-[1.6]">{body}</p>
      <div role="img" aria-label={illustrationLabel}>
        <div aria-hidden="true">{illustration}</div>
      </div>
    </li>
  );
}

/** Step 1 일러스트 — 입력 토글(Figma Input Mode Toggle, well 배경, p 4, gap 2). */
function InputToggleIllustration() {
  const segment = "rounded-full px-3.5 py-[7px] text-[13px] font-semibold whitespace-nowrap";
  return (
    <div className="bg-surface-well inline-flex max-w-full flex-wrap gap-0.5 rounded-full p-1">
      <span className={`${segment} ${LANDING_PRIMARY_SURFACE}`}>필기로 문제 인식</span>
      <span className={`${segment} text-landing-brand-deep`}>사진으로 문제 인식</span>
    </div>
  );
}

/** Step 2 일러스트 — 손글씨 박스(well, radius 16, px 14, py 12, Gaegu 17/1.5, 기호만 STIX). */
function HandwritingIllustration() {
  const math = "font-landing-math";
  return (
    <div className="bg-surface-well rounded-landing-well font-landing-hand text-landing-brand-deep px-3.5 py-3 text-[17px] leading-[1.5]">
      <p className="m-0">
        D = b<span className={math}>²</span> <span className={math}>−</span> 4ac
      </p>
      <p className="m-0">
        a=<span className={math}>−</span>2, b=4 <span className={math}>→</span> D = 24
      </p>
      <p className="m-0">
        D <span className={math}>≥</span> 0 이면 최댓값…?
      </p>
    </div>
  );
}

/** How · 3 Touches(`447:43`). 1024 이상 3열, 그 아래 1열(§6.2 잠정). */
export function HowSection() {
  return (
    <section id="how" aria-labelledby="how-title" className={LANDING_SCROLL_MARGIN}>
      <div className={`${LANDING_CONTAINER} flex flex-col gap-[30px] pt-6 pb-12 lg:pb-[72px]`}>
        <SectionHeader titleId="how-title" weight="black" eyebrow="HOW IT WORKS" title="딱 3번 터치면 끝." />
        <ol className="m-0 grid list-none gap-4.5 p-0 lg:grid-cols-3">
          <StepCard
            number={1}
            badge="사진 · 필기"
            title="문제를 사진으로 찍거나 손글씨로 써요"
            body="문제집을 찍거나, 사진 보관함에서 고르거나, Apple Pencil로 문제를 쓸 수 있어요"
            illustration={<InputToggleIllustration />}
            illustrationLabel="입력 방식 예시: 필기로 문제 인식, 사진으로 문제 인식"
          />
          <StepCard
            number={2}
            badge="내 풀이"
            title="풀 수 있는 데까지 혼자서도 풀어봐요"
            body="틀려도 괜찮아요. 한 줄도 못 쓰겠다면 “아직 못 풀겠어요”로 개념과 첫 힌트부터 시작할 수 있어요"
            illustration={<HandwritingIllustration />}
            illustrationLabel="손글씨 풀이 예시: D = b² − 4ac, a=−2, b=4 이면 D = 24, D ≥ 0 이면 최댓값…?"
          />
          <StepCard
            number={3}
            badge="진단"
            title={
              <>
                “봐 주세요” 하면
                <br />
                AI가 친절하게 알려줘요
              </>
            }
            body="계산 엔진이 줄마다 검증해서 맞은 구간, 막힌 줄, 오류 유형, 관련 개념을 알려줘요."
            illustration={
              <LandingButton as="span" variant="primary-m">
                봐 주세요
              </LandingButton>
            }
            illustrationLabel="봐 주세요 버튼 예시"
          />
        </ol>
      </div>
    </section>
  );
}
