import { createContext } from "react";

export interface CapturedImage {
  blob: Blob;
  /** `blobToObjectUrl`로 생성한 미리보기 URL. 더 이상 필요 없어지면 반드시 revoke해야 한다. */
  previewUrl: string;
}

export interface CameraSessionValue {
  /** 촬영 데이터 보유 여부. `capturedImage !== null`의 파생값이며 `/camera/preview` 가드에 사용된다. */
  hasCaptureData: boolean;
  capturedImage: CapturedImage | null;
  /** 촬영된 Blob을 세션에 저장한다(내부적으로 이전 previewUrl은 해제하고 새 objectURL을 생성한다). */
  setCapturedImage: (blob: Blob) => void;
  /** 촬영 데이터를 초기화한다(previewUrl objectURL도 함께 해제한다). */
  clearCapturedImage: () => void;
}

export const CameraSessionContext = createContext<CameraSessionValue | undefined>(undefined);
