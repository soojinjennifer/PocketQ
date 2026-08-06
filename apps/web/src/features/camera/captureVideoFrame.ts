/** 현재 `<video>` 프레임을 canvas에 그려 Blob으로 캡처한다. */
export function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("2D 캔버스 컨텍스트를 생성할 수 없습니다."));
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("이미지 캡처에 실패했습니다."));
      }
    }, "image/jpeg", 0.92);
  });
}
