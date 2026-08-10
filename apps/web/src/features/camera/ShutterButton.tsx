import { useState, type RefObject } from "react";
import { resizeImageBlob } from "../../shared/lib/image/resizeImageBlob";
import { captureVideoFrame } from "./captureVideoFrame";

/** PRD 비기능요구사항: 이미지 업로드 전 클라이언트 리사이즈 최대 변 길이. */
const MAX_DIMENSION = 1568;

interface ShutterButtonProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stopStream: () => void;
  /** 리사이즈까지 끝난 Blob을 상위(페이지)로 전달한다 — 촬영 데이터 저장/이동은 상위 책임이다
   *  (이 컴포넌트는 `features/problem-input`을 직접 참조하지 않는 순수 props 기반 컴포넌트). */
  onCapture: (resizedBlob: Blob) => void;
}

/**
 * Figma `Camera/Shutter`(node `48:110` 내부) — 클릭 시 현재 비디오 프레임을 캡처·리사이즈해서
 * `onCapture`로 상위에 전달하고, 카메라 스트림을 정지한다.
 */
export function ShutterButton({ videoRef, stopStream, onCapture }: ShutterButtonProps) {
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
      stopStream();
      onCapture(resizedBlob);
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
