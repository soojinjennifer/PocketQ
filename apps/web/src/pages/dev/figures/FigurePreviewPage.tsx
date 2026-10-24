/**
 * 개발 전용 도형 미리보기 `/dev/figures` — `docs/FIGURE_DESIGN.md` §13.
 *
 * `import.meta.env.DEV`일 때만 라우트에 등록되고(app/routes.tsx), 운영 번들에는 들어가지 않는다.
 * - F01~F09: 카드(ELEVATED_CARD_STYLE) 안 FigureView, 단계 선택(FilterPill), 폭 380/708 비교.
 * - 계산 좌표와 fixture 기대값(손 계산) 비교표.
 * - F10·F11: 거부 사유(개발 화면 전용). 구조는 맞고 의미만 틀린 도형은 대체 표시도 함께 보인다.
 */
import { useState } from "react";
import { FilterPill } from "../../../shared/ui/filter-pill/FilterPill";
import { ELEVATED_CARD_STYLE } from "../../../features/ai-solution/elevatedCardStyle";
import { FigureView } from "../../../features/figure-visualization/FigureView";
import { parseFigureSpec, useFigureSpec } from "../../../features/figure-visualization/useFigureSpec";
import {
  STAGE1_REJECT_FIGURE_FIXTURES,
  STAGE2_REJECT_FIGURE_FIXTURES,
  STAGE2_SEMANTIC_FIGURE_FIXTURES,
  VALID_FIGURE_FIXTURES,
  type FigureFixture,
} from "validation/fixtures";
import { figureSpecSchema } from "validation";
import { compareFixture } from "./compareFixture";

/** 결과 패널 Body 폭 — Default 380px / Extend 708px(§7.4). 카드 p-4 안쪽 보드 폭은 348 / 676. */
const PANEL_WIDTHS = [
  { label: "Default 380", className: "w-[380px]" },
  { label: "Extend 708", className: "w-[708px]" },
] as const;

function ValidFixtureSection({ fixture }: { fixture: FigureFixture }) {
  const parsed = useFigureSpec(fixture.raw);
  const [stepId, setStepId] = useState<string | null>(null);
  if (!parsed.ok) {
    return <p className="text-label-primary text-[12px]">{`${fixture.id}: ${parsed.reason}`}</p>;
  }
  const { spec } = parsed;
  const rows = compareFixture(fixture);

  return (
    <section className="flex flex-col gap-3" aria-label={`${fixture.id} ${fixture.title}`}>
      <h2 className="text-label-primary text-[17px] leading-[22px] font-[590]">{`${fixture.id} ${fixture.title}`}</h2>
      <div className="flex flex-wrap gap-2">
        <FilterPill label="최종" selected={stepId === null} onClick={() => setStepId(null)} />
        {spec.steps.map((step) => (
          <FilterPill key={step.stepId} label={step.stepId} selected={stepId === step.stepId} onClick={() => setStepId(step.stepId)} />
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-4">
        {PANEL_WIDTHS.map((width) => (
          <div key={width.label} className={`flex shrink-0 flex-col gap-1 ${width.className}`}>
            <p className="text-label-primary text-[12px]">{width.label}</p>
            <div className={ELEVATED_CARD_STYLE}>
              <FigureView spec={spec} stepId={stepId} />
            </div>
          </div>
        ))}
      </div>
      {rows.length > 0 ? (
        <table className="text-label-primary w-fit text-[12px] tabular-nums">
          <thead>
            <tr>
              <th className="px-2 text-left">요소</th>
              <th className="px-2 text-left">기대값(손 계산)</th>
              <th className="px-2 text-left">계산값</th>
              <th className="px-2 text-left">차이</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-2">{row.id}</td>
                <td className="px-2">{row.expected}</td>
                <td className="px-2">{row.actual}</td>
                <td className="px-2">{row.difference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function RejectedFixtureRow({ fixture }: { fixture: FigureFixture }) {
  const result = parseFigureSpec(fixture.raw);
  const schemaOnly = figureSpecSchema.safeParse(fixture.raw);
  return (
    <div className="flex w-[380px] shrink-0 flex-col gap-1">
      <p className="text-label-primary text-[12px] font-[590]">{`${fixture.id} ${fixture.title}`}</p>
      {schemaOnly.success ? (
        <div className={ELEVATED_CARD_STYLE}>
          <FigureView spec={schemaOnly.data} />
        </div>
      ) : null}
      <p className="text-label-primary text-[12px] break-all">{result.ok ? "통과(예상과 다름)" : result.reason}</p>
    </div>
  );
}

export function FigurePreviewPage() {
  const rejected = [...STAGE2_REJECT_FIGURE_FIXTURES, ...STAGE1_REJECT_FIGURE_FIXTURES, ...STAGE2_SEMANTIC_FIGURE_FIXTURES];
  return (
    <main className="bg-bg-primary flex min-h-dvh flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-label-primary text-[22px] leading-[28px] font-[590]">도형 미리보기 (개발 전용)</h1>
        <p className="text-label-primary text-[13px] leading-[18px]">
          fixture를 JSXGraph 렌더러로 그린다. 기대값은 검증 커널과 무관한 손 계산이다.
        </p>
      </header>
      {VALID_FIGURE_FIXTURES.map((fixture) => (
        <ValidFixtureSection key={fixture.id} fixture={fixture} />
      ))}
      <section className="flex flex-col gap-3" aria-label="거부되는 fixture">
        <h2 className="text-label-primary text-[17px] leading-[22px] font-[590]">거부되는 fixture (F10·F11)</h2>
        <div className="flex flex-wrap items-start gap-4">
          {rejected.map((fixture) => (
            <RejectedFixtureRow key={fixture.id} fixture={fixture} />
          ))}
        </div>
      </section>
    </main>
  );
}
