import { useState, type RefObject } from "react";
import { useNavigate } from "react-router";
import { resizeImageBlob } from "../../shared/lib/image/resizeImageBlob";
import { captureVideoFrame } from "./captureVideoFrame";
import { useCameraSession } from "./useCameraSession";

/** PRD 비기능요구사항: 이미지 업로드 전 클라이언트 리사이즈 최대 변 길이. */
const MAX_DIMENSION = 1568;

interface ShutterButtonProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stopStream: () => void;
}

/**
 * Figma `Camera/Shutter`(node `48:110` 내부) — 클릭 시 현재 비디오 프레임을 캡처해
 * 촬영 세션에 저장하고, 카메라 스트림을 정지한 뒤 `/camera/preview`로 이동한다.
 */
export function ShutterButton({ videoRef, stopStream }: ShutterButtonProps) {
  const navigate = useNavigate();
  const { setCapturedImage } = useCameraSession();
  const [isCapturing, setIsCapturing] = useState(false);

  const handleClick = async () => {
    const video = videoRef.current;
    if (!video || isCapturing) {
      return;
    }

    setIsCapturing(true);
    try {
      const frameBlob = await captureVideoFrame(video);
      const resizedBlob = await resizeImageBlob(frameBlob, MAX_DIMENSION);
      setCapturedImage(resizedBlob);
      stopStream();
      void navigate("/camera/preview");
    } catch {
      setIsCapturing(false);
    }
  };

  return (
    <button
      type="button"
      aria-label="촬영"
      disabled={isCapturing}
      onClick={() => void handleClick()}
      className="border-label-on-dark flex size-[66px] items-center justify-center rounded-full border-[4px] disabled:opacity-60"
    >
      <span className="bg-label-on-dark block size-[52px] rounded-full" />
    </button>
  );
}
