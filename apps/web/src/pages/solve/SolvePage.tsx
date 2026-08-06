import { PenRail } from "../../features/drawing-canvas/PenRail";
import { ActionBar } from "../../features/solve-session/ActionBar";
import { ProblemCard, type ProblemCardData } from "../../features/solve-session/ProblemCard";
import { SolveNavTabs } from "../../features/solve-session/SolveNavTabs";
import { useCapturedImageUrl } from "../../features/solve-session/useCapturedImageUrl";
import { Logo } from "../../shared/ui/logo/Logo";

/** Figma 문제풀기 화면 — Logo/NavTabBar/PenRail/ProblemCard/ActionBar를 조립한다. */
export function SolvePage() {
  const capturedImageUrl = useCapturedImageUrl();
  const problemCardData: ProblemCardData = capturedImageUrl ? { imageUrl: capturedImageUrl } : null;

  return (
    <div className="bg-bg-primary relative min-h-screen">
      <div className="absolute top-6 left-6 z-10">
        <Logo size="small" />
      </div>
      <div className="absolute top-6 left-1/2 z-10 -translate-x-1/2">
        <SolveNavTabs />
      </div>

      <PenRail />

      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-24">
        <ProblemCard data={problemCardData} />
        <ActionBar hasProblem={problemCardData !== null} />
      </main>
    </div>
  );
}
