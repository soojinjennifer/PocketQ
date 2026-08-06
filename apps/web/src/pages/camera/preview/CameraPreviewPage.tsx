import { useNavigate } from "react-router";
import { CameraTopBar } from "../../../features/camera/CameraTopBar";
import { ProblemSheet } from "../../../features/camera/ProblemSheet";
import { useCameraSession } from "../../../features/camera/useCameraSession";
import { Button } from "../../../shared/ui/button/Button";

/** Figma `51:129` — 촬영 미리보기 화면. `CameraPreviewGuard`가 촬영 데이터 없이는 접근을 막는다. */
export function CameraPreviewPage() {
  const navigate = useNavigate();
  const { capturedImage, clearCapturedImage } = useCameraSession();

  const handleRetake = () => {
    clearCapturedImage();
    void navigate("/camera");
  };

  const handleUsePhoto = () => {
    if (!capturedImage) {
      return;
    }
    void navigate("/solve", { state: { capturedImageUrl: capturedImage.previewUrl } });
  };

  return (
    <div className="bg-bg-camera-sheet relative flex min-h-screen flex-col">
      <CameraTopBar title="이대로 사용할까요?" />

      <div className="bg-bg-viewfinder relative mx-4 flex flex-1 items-center justify-center overflow-hidden rounded-[14px]">
        {capturedImage ? (
          <img
            src={capturedImage.previewUrl}
            alt="촬영한 문제 미리보기"
            className="size-full object-contain"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 px-6 py-6">
        <Button variant="pill-glass" onClick={handleRetake}>
          재촬영
        </Button>
        <Button variant="pill-primary" onClick={handleUsePhoto}>
          사진 사용
        </Button>
      </div>

      <div className="px-6 pb-8">
        <ProblemSheet message="이 사진으로 문제를 인식할게요" />
      </div>
    </div>
  );
}
