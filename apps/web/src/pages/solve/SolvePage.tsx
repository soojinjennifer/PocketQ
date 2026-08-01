import { Logo } from "../../shared/ui/logo/Logo";
import { PagePlaceholder } from "../../shared/ui/page-placeholder/PagePlaceholder";

export function SolvePage() {
  return (
    <div className="relative">
      <div className="absolute top-6 left-6">
        <Logo size="small" />
      </div>
      <PagePlaceholder pageName="SolvePage" route="/solve" />
    </div>
  );
}
