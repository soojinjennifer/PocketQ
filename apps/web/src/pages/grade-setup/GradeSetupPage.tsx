import { useGradeSetup } from "../../features/grade-setup/useGradeSetup";
import { Button } from "../../shared/ui/button/Button";
import { Logo } from "../../shared/ui/logo/Logo";
import { Spinner } from "../../shared/ui/spinner/Spinner";

/**
 * 최소 기술 학년 설정 UI (Figma 최종 디자인 아님, GRADE-1).
 * 중1~중3, 고1~고3 6개 선택지를 제공하고 선택 시 user_metadata.grade를 저장한 뒤 /solve로 이동한다.
 */
export function GradeSetupPage() {
  const { gradeOptions, pendingGrade, isSubmitting, errorMessage, selectGrade } = useGradeSetup();

  return (
    <div className="bg-bg-primary flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size="large" />
        <h1 className="text-label-primary text-lg font-semibold">학년을 선택해 주세요</h1>
        <p className="text-label-secondary text-sm">
          선택한 학년의 교육과정에 맞춰 개념을 설명해 드려요
        </p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        {gradeOptions.map((option) => (
          <Button
            key={option.value}
            variant="primary"
            disabled={isSubmitting}
            aria-pressed={pendingGrade === option.value}
            onClick={() => void selectGrade(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div role="alert" aria-live="polite" className="min-h-5 text-sm">
        {errorMessage ? <span className="text-accent-orange">{errorMessage}</span> : null}
      </div>

      {isSubmitting ? (
        <div className="flex justify-center">
          <Spinner label="처리 중" />
        </div>
      ) : null}
    </div>
  );
}
