/**
 * 결과 패널 도형 슬롯(Stage 4, `docs/FIGURE_DESIGN.md` §17.1·§17.2·§17.4·§17.6·§17.7).
 *
 * 페이지가 `VITE_FIGURES_ENABLED === "true"`일 때만 `React.lazy`로 불러온다(default export). 이 모듈은 검증 커널과
 * 렌더러(`FigureView`)를 import하므로 결과 화면 메인 번들에 들어가면 안 된다.
 *
 * - 슬롯 루트: `aria-live="off"`(늦게 온 그림을 결과 Body의 live 영역이 읽지 않게), waiting 중 `aria-busy`.
 *   보일 것이 없으면 `hidden`(flex 간격 0 — 레이아웃 불변).
 * - waiting: 500ms(S4-V1) 지난 뒤에만 Spinner 한 줄(`announce={false}`). empty·오류·abort·idle은 아무것도 없다.
 * - received: 그림 카드(`ElevatedCard as="section"`, gap-3) 1~3개, 캡션 "그림"/"그림 1~3".
 * - 스테퍼: 분할 성공 + 그 그림에 단계 정보가 있을 때만. [이전] "N단계 / M"·"최종" [다음], `pill-tint min-h-11`.
 *   기본 = 최종, 순환 없음, 끝에서 disabled가 되면 반대 버튼으로 포커스 이동. 상태 텍스트에만 `aria-live`.
 *   단계 k는 페이지 state(모든 그림·단계 블록이 공유).
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FigureSpec } from "shared-types";
import { splitSolutionSteps } from "validation";
import { Button } from "../../shared/ui/button/Button";
import { ElevatedCard } from "../../shared/ui/card/ElevatedCard";
import { Spinner } from "../../shared/ui/spinner/Spinner";
import { FigureView } from "./FigureView";

/** 훅 `figuresPhase`와 같은 값(`features/ai-solution/figuresPhase.ts`) — feature 간 import를 피하려고 구조적으로 받는다. */
export type SolutionFiguresPhase = "idle" | "waiting" | "received" | "empty";

/** waiting 대기 줄 표시 지연(S4-V1, 오너 승인). */
export const FIGURES_WAITING_DELAY_MS = 500;

export interface SolutionFiguresProps {
  phase: SolutionFiguresPhase;
  /** 서버가 검증해 보낸 도형(`result.figures`). */
  figures: readonly FigureSpec[] | undefined;
  /** 단계 표지가 있는 풀이 섹션 본문(단계 수 계산용). */
  solutionMd: string | null;
  /** 현재 전역 단계 1~N, null = 최종. */
  step: number | null;
  onStepChange: (step: number | null) => void;
}

function hasStepInfo(figure: FigureSpec): boolean {
  return figure.steps.length > 0 || figure.elements.some((element) => element.appearAt !== null);
}

interface StepperProps {
  step: number | null;
  stepCount: number;
  onStepChange: (step: number | null) => void;
}

function FigureStepper({ step, stepCount, onStepChange }: StepperProps) {
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const atFirst = step === 1;
  const atFinal = step === null;

  const goPrev = (): void => {
    const target = step === null ? stepCount : step - 1;
    onStepChange(target);
    // 누른 버튼이 이 동작으로 disabled가 되면 포커스가 사라지지 않게 반대쪽 버튼으로 옮긴다.
    if (target === 1) nextRef.current?.focus();
  };
  const goNext = (): void => {
    const target = step === null ? null : step >= stepCount ? null : step + 1;
    onStepChange(target);
    if (target === null) prevRef.current?.focus();
  };

  return (
    <div role="group" aria-label="그림 단계 이동" className="flex items-center gap-2">
      <Button ref={prevRef} variant="pill-tint" className="min-h-11" disabled={atFirst} onClick={goPrev}>
        이전
      </Button>
      <p aria-live="polite" aria-atomic="true" className="text-label-primary flex-1 text-center text-[13px] leading-[18px] font-[590] tabular-nums">
        {atFinal ? "최종" : `${step}단계 / ${stepCount}`}
      </p>
      <Button ref={nextRef} variant="pill-tint" className="min-h-11" disabled={atFinal} onClick={goNext}>
        다음
      </Button>
    </div>
  );
}

function FigureCard({
  figure,
  caption,
  stepper,
  step,
}: {
  figure: FigureSpec;
  caption: string;
  stepper: StepperProps | null;
  step: number | null;
}) {
  const captionId = useId();
  return (
    <ElevatedCard as="section" className="flex flex-col gap-3" aria-labelledby={captionId}>
      <p id={captionId} className="text-brand text-[12px] leading-[16px] font-[590]">
        {caption}
      </p>
      {stepper ? <FigureStepper {...stepper} /> : null}
      <FigureView spec={figure} step={stepper && step !== null ? step : "final"} />
    </ElevatedCard>
  );
}

export function SolutionFigures({ phase, figures, solutionMd, step, onStepChange }: SolutionFiguresProps) {
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);
  useEffect(() => {
    if (phase !== "waiting") return undefined;
    const timer = window.setTimeout(() => setWaitedLongEnough(true), FIGURES_WAITING_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      setWaitedLongEnough(false);
    };
  }, [phase]);

  const stepCount = useMemo(() => {
    const split = splitSolutionSteps(solutionMd);
    return split.ok ? split.stepCount : null;
  }, [solutionMd]);

  const list = phase === "received" ? (figures ?? []) : [];
  const showSpinner = phase === "waiting" && waitedLongEnough;
  const visible = list.length > 0 || showSpinner;

  return (
    <div aria-live="off" aria-busy={phase === "waiting" ? true : undefined} hidden={!visible} className="flex flex-col gap-3">
      {showSpinner ? <Spinner label="그림을 준비하는 중" announce={false} /> : null}
      {list.map((figure, index) => (
        <FigureCard
          key={`${figure.figureId}-${index}`}
          figure={figure}
          caption={list.length > 1 ? `그림 ${index + 1}` : "그림"}
          stepper={stepCount !== null && hasStepInfo(figure) ? { step, stepCount, onStepChange } : null}
          step={step}
        />
      ))}
    </div>
  );
}

export default SolutionFigures;
