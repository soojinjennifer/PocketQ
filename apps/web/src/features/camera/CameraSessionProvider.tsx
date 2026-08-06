import { useCallback, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router";
import { blobToObjectUrl, revokeObjectUrl } from "../../shared/lib/image/objectUrl";
import { CameraSessionContext, type CapturedImage } from "./CameraSessionContext";

/**
 * /camera 레이아웃 라우트 — 촬영 세션 상태를 이 서브트리(/camera, /camera/preview)에만 scope한다.
 * URL이나 전역 상태에는 저장하지 않는다(오너 확정: "촬영 상태는 features/camera에서 로컬로만 관리").
 * "사진 사용" 확정 이후에는 React Router state로 /solve에 전달하며, 이 Context를 /solve까지
 * 확장하지 않는다.
 */
export function CameraSessionProvider() {
  const [capturedImage, setCapturedImageState] = useState<CapturedImage | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const setCapturedImage = useCallback((blob: Blob) => {
    if (previewUrlRef.current) {
      revokeObjectUrl(previewUrlRef.current);
    }
    const previewUrl = blobToObjectUrl(blob);
    previewUrlRef.current = previewUrl;
    setCapturedImageState({ blob, previewUrl });
  }, []);

  const clearCapturedImage = useCallback(() => {
    if (previewUrlRef.current) {
      revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setCapturedImageState(null);
  }, []);

  const value = useMemo(
    () => ({
      hasCaptureData: capturedImage !== null,
      capturedImage,
      setCapturedImage,
      clearCapturedImage,
    }),
    [capturedImage, setCapturedImage, clearCapturedImage],
  );

  return (
    <CameraSessionContext.Provider value={value}>
      <Outlet />
    </CameraSessionContext.Provider>
  );
}
