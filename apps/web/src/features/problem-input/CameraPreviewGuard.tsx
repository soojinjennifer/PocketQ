import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useProblemInput } from "./useProblemInput";

interface CameraPreviewGuardProps {
  children: ReactNode;
}

/**
 * 촬영 데이터 없이 `/camera/preview`에 직접 접근하면 `/camera`로 replace 이동시킨다.
 * `features/camera`가 아니라 `features/problem-input`에 있는 이유: 이 가드가 참조하는 상태
 * (`hasCaptureData`)의 소유권이 `ProblemInputProvider`에 있고, feature 간 직접 참조를 피하기
 * 위해 상태를 소유한 feature가 가드도 함께 제공한다.
 */
export function CameraPreviewGuard({ children }: CameraPreviewGuardProps) {
  const { hasCaptureData } = useProblemInput();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasCaptureData) {
      void navigate("/camera", { replace: true });
    }
  }, [hasCaptureData, navigate]);

  if (!hasCaptureData) {
    return null;
  }

  return <>{children}</>;
}
