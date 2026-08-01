import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useCameraSession } from "./useCameraSession";

interface CameraPreviewGuardProps {
  children: ReactNode;
}

/** 촬영 데이터 없이 /camera/preview에 직접 접근하면 /camera로 replace 이동시킨다. */
export function CameraPreviewGuard({ children }: CameraPreviewGuardProps) {
  const { hasCaptureData } = useCameraSession();
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
