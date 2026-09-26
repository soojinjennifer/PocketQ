import { useCallback, useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { preparePhotoForUpload, type PhotoUploadErrorKind, type PreparePhotoResult } from "./preparePhotoForUpload";
import { useProblemInput } from "./useProblemInput";

export interface UsePhotoUploadOptions {
  /** 정규화된 사진이 `setCapturedImage`로 저장된 직후 호출된다(예: 입력 모드를 "upload"로 전환). */
  onUploaded: () => void;
  /** 테스트용 주입 지점 — 기본값은 실제 검증 + JPEG 정규화다. */
  prepare?: (file: File) => Promise<PreparePhotoResult>;
}

export interface PhotoUploadInputProps {
  ref: RefObject<HTMLInputElement | null>;
  type: "file";
  accept: "image/*";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  className: "sr-only";
  tabIndex: -1;
  "aria-hidden": true;
  "data-testid": "photo-upload-input";
}

export interface UsePhotoUploadResult {
  /** 탭 핸들러 안에서 동기적으로 호출해야 한다 — iOS는 `await` 이후의 `input.click()`을 막을 수 있다. */
  openPicker: () => void;
  inputProps: PhotoUploadInputProps;
  isProcessing: boolean;
  errorKind: PhotoUploadErrorKind | null;
  dismissError: () => void;
}

/**
 * "사진 업로드" 입력(INPUT-4) — 숨은 파일 input을 열고, 고른 사진을 검증/JPEG 정규화한 뒤
 * `setCapturedImage`에 넘긴다. `capture`/`multiple`은 쓰지 않는다(카메라 직행 금지, 1장만).
 * 원본 `File`은 보관하지 않고 재인코딩된 Blob만 Provider가 보관한다.
 */
export function usePhotoUpload({ onUploaded, prepare = preparePhotoForUpload }: UsePhotoUploadOptions): UsePhotoUploadResult {
  const { setCapturedImage } = useProblemInput();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorKind, setErrorKind] = useState<PhotoUploadErrorKind | null>(null);

  // 처리 중 새 선택이 오거나 언마운트되면 이전 처리 결과를 버리기 위한 세대 번호.
  const generationRef = useRef(0);
  const isProcessingRef = useRef(false);
  const onUploadedRef = useRef(onUploaded);
  const setCapturedImageRef = useRef(setCapturedImage);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
    setCapturedImageRef.current = setCapturedImage;
  });

  useEffect(
    () => () => {
      generationRef.current += 1;
    },
    [],
  );

  const openPicker = useCallback(() => {
    if (isProcessingRef.current) {
      return;
    }
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      generationRef.current += 1;
      const generation = generationRef.current;
      isProcessingRef.current = true;
      setIsProcessing(true);
      setErrorKind(null);

      try {
        const result = await prepare(file);
        if (generation !== generationRef.current) {
          return;
        }
        if (result.ok) {
          setCapturedImageRef.current(result.blob);
          onUploadedRef.current();
        } else {
          setErrorKind(result.kind);
        }
      } catch {
        if (generation === generationRef.current) {
          setErrorKind("decode-failed");
        }
      } finally {
        // 같은 파일을 다시 고르면 change가 오지 않는 문제를 막기 위해 항상 초기화한다.
        input.value = "";
        if (generation === generationRef.current) {
          isProcessingRef.current = false;
          setIsProcessing(false);
        }
      }
    },
    [prepare],
  );

  const dismissError = useCallback(() => setErrorKind(null), []);

  return {
    openPicker,
    inputProps: {
      ref: inputRef,
      type: "file",
      accept: "image/*",
      onChange: (event) => void handleChange(event),
      className: "sr-only",
      tabIndex: -1,
      "aria-hidden": true,
      "data-testid": "photo-upload-input",
    },
    isProcessing,
    errorKind,
    dismissError,
  };
}
