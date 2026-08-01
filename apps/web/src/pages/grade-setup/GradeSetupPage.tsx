import { Logo } from "../../shared/ui/logo/Logo";
import { PagePlaceholder } from "../../shared/ui/page-placeholder/PagePlaceholder";

export function GradeSetupPage() {
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <Logo size="large" />
      </div>
      <PagePlaceholder pageName="GradeSetupPage" route="/grade-setup" />
    </div>
  );
}
