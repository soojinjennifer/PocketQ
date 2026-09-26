/** 업로드 사진 정규화 실패 종류 — 호출 측이 사용자 안내 문구로 매핑한다. */
export type ReencodeImageErrorKind = "decode-failed" | "encode-failed";

export class ReencodeImageError extends Error {
  readonly kind: ReencodeImageErrorKind;

  constructor(kind: ReencodeImageErrorKind, cause?: unknown) {
    super(`이미지 재인코딩 실패: ${kind}`, { cause });
    this.name = "ReencodeImageError";
    this.kind = kind;
  }
}

/** 디코딩된 이미지 — 캔버스에 그릴 수 있는 소스와 그 원본 픽셀 크기, 그리고 리소스 해제 함수. */
export interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  close: () => void;
}

/** 재인코딩에 필요한 캔버스 표면의 최소 인터페이스(`HTMLCanvasElement`가 그대로 만족한다). */
export interface EncodeSurface {
  width: number;
  height: number;
  getContext(contextId: "2d"): {
    fillStyle: string | CanvasGradient | CanvasPattern;
    fillRect(x: number, y: number, w: number, h: number): void;
    drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  } | null;
  toBlob(callback: BlobCallback, type?: string, quality?: number): void;
}

/**
 * 디코더/캔버스 생성기를 주입할 수 있게 한 이유: jsdom에는 `createImageBitmap`과 실제 canvas가 없어
 * 스케일 계산·흰 배경·에러 매핑 같은 순수 로직을 브라우저 API 없이 검증하기 위함이다
 * (`normalizeProblemInput`의 `exportStrokes` 주입 패턴과 동일).
 */
export interface ReencodeImageDeps {
  decode: (file: Blob) => Promise<DecodedImage>;
  createCanvas: (width: number, height: number) => EncodeSurface;
}

/** PRD 비기능요구사항(§성능)의 클라이언트 리사이즈 상한 — `ShutterButton`의 카메라 경로와 같은 값. */
export const DEFAULT_MAX_DIMENSION = 1568;
export const JPEG_QUALITY = 0.92;

/** 긴 변이 `maxDimension`을 넘으면 종횡비를 유지해 축소하고, 넘지 않으면 확대 없이 그대로 둔다. */
export function computeTargetSize(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / longestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * 기본 디코더 — EXIF 회전을 반영해 디코딩한다(`imageOrientation: "from-image"`). `createImageBitmap`이
 * 없거나 실패하면 `HTMLImageElement` + objectURL로 폴백한다(최신 브라우저의 `<img>`는 EXIF 회전을
 * 기본 적용한다).
 */
async function defaultDecode(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        close: () => bitmap.close(),
      };
    } catch {
      // 폴백으로 계속 진행한다.
    }
  }
  return decodeWithImageElement(file);
}

const defaultDeps: ReencodeImageDeps = {
  decode: defaultDecode,
  createCanvas: (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
};

/**
 * 업로드한 사진을 긴 변 `maxDimension` 이하의 JPEG(품질 0.92) Blob으로 정규화한다.
 * `resizeImageBlob`은 작은 이미지를 원본 그대로(PNG면 PNG로) 반환하므로 재사용하지 않고, 항상
 * JPEG로 다시 인코딩한다. JPEG는 알파를 지원하지 않아 투명 PNG가 검정으로 바뀌므로 흰 배경을 먼저
 * 채운 뒤 그린다(`exportStrokesToJpegBlob`과 같은 패턴).
 *
 * @throws {ReencodeImageError} 디코딩 실패(`decode-failed`) 또는 인코딩 실패(`encode-failed`).
 */
export async function reencodeImageToJpeg(
  file: Blob,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
  deps: ReencodeImageDeps = defaultDeps,
): Promise<Blob> {
  let decoded: DecodedImage;
  try {
    decoded = await deps.decode(file);
  } catch (error) {
    throw new ReencodeImageError("decode-failed", error);
  }

  try {
    if (decoded.width <= 0 || decoded.height <= 0) {
      throw new ReencodeImageError("decode-failed");
    }

    const target = computeTargetSize(decoded.width, decoded.height, maxDimension);
    const canvas = deps.createCanvas(target.width, target.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new ReencodeImageError("encode-failed");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(decoded.source, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) {
      throw new ReencodeImageError("encode-failed");
    }
    return blob;
  } finally {
    decoded.close();
  }
}
