import { useLocation } from "react-router";

interface SolveLocationState {
  capturedImageUrl?: string;
}

function isSolveLocationState(state: unknown): state is SolveLocationState {
  return typeof state === "object" && state !== null;
}

/**
 * `/camera/preview`에서 "사진 사용" 확정 시 `navigate("/solve/pencilcanvas", { state: { capturedImageUrl } })`로
 * 전달한 촬영 이미지 URL을 읽는다(오너 확정: React Router state로 전달, `CameraSessionContext`는
 * `/camera` 서브트리 범위를 유지한다).
 */
export function useCapturedImageUrl(): string | undefined {
  const location = useLocation();

  if (
    isSolveLocationState(location.state) &&
    typeof location.state.capturedImageUrl === "string"
  ) {
    return location.state.capturedImageUrl;
  }

  return undefined;
}
