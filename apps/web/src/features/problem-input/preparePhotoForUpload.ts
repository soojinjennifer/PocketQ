import { reencodeImageToJpeg } from "../../shared/lib/image/reencodeImageToJpeg";

/** 서버 업로드 상한(`apps/api/src/modules/recognition/upload.ts`)과 같은 5MB — 정규화 후 Blob 기준이다. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type PhotoUploadErrorKind = "not-image" | "decode-failed" | "too-large";

export type PreparePhotoResult =
  | { ok: true; blob: Blob }
  | { ok: false; kind: PhotoUploadErrorKind };

export interface PreparePhotoDeps {
  reencode: (file: Blob) => Promise<Blob>;
}

const defaultDeps: PreparePhotoDeps = { reencode: (file) => reencodeImageToJpeg(file) };

/** iOS는 HEIC/HEIF 파일의 `type`을 빈 문자열로 주는 경우가 있어 확장자로도 이미지를 판별한다. */
const HEIC_EXTENSION_PATTERN = /\.(heic|heif)$/i;

function looksLikeImage(file: File): boolean {
  return file.type.startsWith("image/") || HEIC_EXTENSION_PATTERN.test(file.name);
}

/**
 * 사용자가 고른 파일을 검증하고 서버 전송용 JPEG로 정규화한다. 원본 크기에는 사전 상한을 두지 않고
 * (12MP+ 사진도 리사이즈로 줄어든다), 정규화된 결과가 서버 상한을 넘을 때만 거절한다.
 */
export async function preparePhotoForUpload(
  file: File,
  deps: PreparePhotoDeps = defaultDeps,
): Promise<PreparePhotoResult> {
  if (!looksLikeImage(file)) {
    return { ok: false, kind: "not-image" };
  }

  let blob: Blob;
  try {
    blob = await deps.reencode(file);
  } catch {
    // 디코딩/인코딩 실패는 사용자 관점에서 모두 "사진을 읽지 못함"이므로 같은 안내로 묶는다.
    return { ok: false, kind: "decode-failed" };
  }

  if (blob.size > MAX_UPLOAD_BYTES) {
    return { ok: false, kind: "too-large" };
  }
  return { ok: true, blob };
}
