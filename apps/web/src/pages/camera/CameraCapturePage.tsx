import { useEffect } from "react";
import { useNavigate } from "react-router";
import { CameraTopBar } from "../../features/camera/CameraTopBar";
import { FrameGuides } from "../../features/camera/FrameGuides";
import { ProblemSheet } from "../../features/camera/ProblemSheet";
import { ShutterButton } from "../../features/camera/ShutterButton";
import type { CameraPermissionError } from "../../features/camera/useCameraCapture";
import { useCameraCapture } from "../../features/camera/useCameraCapture";
import { useProblemInput } from "../../features/problem-input/useProblemInput";

const ERROR_MESSAGE: Record<CameraPermissionError, string> = {
  "permission-denied": "카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해 주세요.",
  "not-found": "사용할 수 있는 카메라를 찾을 수 없습니다.",
  unsupported: "이 브라우저는 카메라 촬영을 지원하지 않습니다.",
  unknown: "카메라를 시작할 수 없습니다.",
};

/** Figma `48:110` — 사진 촬영 화면. */
export function CameraCapturePage() {
  const navigate = useNavigate();
  const { clearCapturedImage, setCapturedImage } = useProblemInput();
  const { videoRef, error, stopStream, retry } = useCameraCapture();

  // 오너 확정: 이 페이지가 마운트될 때마다(재촬영 버튼이든 브라우저 뒤로가기든) 항상 깨끗한
  // 상태로 시작한다.
  useEffect(() => {
    clearCapturedImage();
  }, [clearCapturedImage]);

  const handleCapture = (resizedBlob: Blob) => {
    setCapturedImage(resizedBlob);
    void navigate("/camera/preview");
  };

  return (
    <div className="bg-bg-camera-sheet relative flex h-dvh flex-col">
      <CameraTopBar title="문제가 잘 보이게 맞춰 주세요" />

      <div className="bg-bg-viewfinder relative mx-4 flex flex-1 items-center justify-center overflow-hidden rounded-[14px]">
        {error ? (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <p className="text-label-on-dark text-[15px]">{ERROR_MESSAGE[error]}</p>
            <button
              type="button"
              onClick={retry}
              className="text-label-on-dark border-glass-border bg-glass-fill rounded-full border px-5 py-2 text-[14px] font-semibold"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
            <FrameGuides />
          </>
        )}
      </div>

      <div className="grid grid-cols-3 items-center px-6 py-6">
        <button type="button" className="text-label-on-dark justify-self-start text-[15px] font-semibold">
          앨범
        </button>
        <div className="justify-self-center">
          <ShutterButton videoRef={videoRef} stopStream={stopStream} onCapture={handleCapture} />
        </div>
        <div />
      </div>

      <div className="px-6 pb-8">
        <ProblemSheet message="문제 영역을 사각형 안에 맞춰주세요" />
      </div>
    </div>
  );
}
