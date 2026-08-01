import { Outlet } from "react-router";
import { CameraSessionContext } from "./CameraSessionContext";

/**
 * /camera 레이아웃 라우트 — 촬영 세션 상태를 이 서브트리(/camera, /camera/preview)에만 scope한다.
 * URL이나 전역 상태에는 저장하지 않는다. 실제 카메라 접근(getUserMedia)/촬영/이미지 저장은
 * 이번 단계 범위 밖이며, 항상 "데이터 없음" 상태를 제공한다.
 */
export function CameraSessionProvider() {
  return (
    <CameraSessionContext.Provider value={{ hasCaptureData: false }}>
      <Outlet />
    </CameraSessionContext.Provider>
  );
}
