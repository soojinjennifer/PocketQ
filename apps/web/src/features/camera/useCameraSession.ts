import { useContext } from "react";
import { CameraSessionContext, type CameraSessionValue } from "./CameraSessionContext";

/** /camera 서브트리 내부에서만 사용 가능한 로컬 촬영 세션 상태 훅. */
export function useCameraSession(): CameraSessionValue {
  const context = useContext(CameraSessionContext);
  if (context === undefined) {
    throw new Error("useCameraSession은 /camera 서브트리 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
