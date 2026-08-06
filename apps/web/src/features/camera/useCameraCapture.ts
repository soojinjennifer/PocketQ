import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type CameraPermissionError = "permission-denied" | "not-found" | "unsupported" | "unknown";

interface UseCameraCaptureResult {
  videoRef: RefObject<HTMLVideoElement | null>;
  error: CameraPermissionError | null;
  isReady: boolean;
  /** 카메라 스트림을 정지한다(촬영 직후 또는 언마운트 시 자동으로도 호출된다). */
  stopStream: () => void;
  /** 카메라 접근을 다시 시도한다(권한 거부/실패 안내 화면의 "다시 시도" 버튼에서 사용). */
  retry: () => void;
}

/**
 * `/camera` 촬영 화면 전용 훅 — 마운트 시 `getUserMedia`로 카메라 스트림을 시작하고,
 * 언마운트 또는 명시적 `stopStream()` 호출 시 트랙을 정지한다. Figma에 카메라 권한
 * 거부/미지원 디자인이 없으므로 에러 상태만 반환하고 UI는 호출부(페이지)에서 최소 구성한다.
 */
export function useCameraCapture(): UseCameraCaptureResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<CameraPermissionError | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsReady(false);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setError("unsupported");
        }
      });
      return () => {
        cancelled = true;
      };
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsReady(true);
      })
      .catch((caughtError: unknown) => {
        if (cancelled) {
          return;
        }
        if (caughtError instanceof DOMException && caughtError.name === "NotAllowedError") {
          setError("permission-denied");
        } else if (caughtError instanceof DOMException && caughtError.name === "NotFoundError") {
          setError("not-found");
        } else {
          setError("unknown");
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [retryToken]);

  return { videoRef, error, isReady, stopStream, retry };
}
