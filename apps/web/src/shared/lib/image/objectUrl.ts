/**
 * Blob → object URL 변환/해제 유틸.
 * 카메라 촬영 미리보기(`features/camera`)에서 사용하며, 생성한 URL은 반드시
 * 더 이상 필요 없어지는 시점(재촬영, 세션 초기화 등)에 `revokeObjectUrl`로 해제해야 한다.
 */
export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
