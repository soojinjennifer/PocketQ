/**
 * 이미지 Blob을 클라이언트에서 리사이즈한다.
 * PRD 비기능요구사항(§성능): "이미지 업로드는 클라이언트에서 리사이즈(최대 1568px) 후 전송".
 * 가로/세로 중 긴 변이 `maxDimension`을 넘지 않도록 축소하며, 이미 그 이하이면 원본을 그대로 반환한다.
 */
export async function resizeImageBlob(blob: Blob, maxDimension: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);

  try {
    const { width, height } = bitmap;
    const longestSide = Math.max(width, height);

    if (longestSide <= maxDimension) {
      return blob;
    }

    const scale = maxDimension / longestSide;
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return blob;
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const resizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), blob.type || "image/jpeg", 0.92);
    });

    return resizedBlob ?? blob;
  } finally {
    bitmap.close();
  }
}
