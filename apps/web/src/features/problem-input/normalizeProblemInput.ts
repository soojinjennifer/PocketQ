import type { Grade } from "shared-types";
import type { Stroke } from "../../shared/lib/canvas/useDrawingStrokes";

export type ProblemInputType = "photo" | "handwriting";

export interface NormalizedProblemInput {
  inputType: ProblemInputType;
  imageBlob: Blob;
  grade: Grade;
}

export interface NormalizeProblemInputParams {
  photoBlob: Blob | null;
  strokes: Stroke[];
  grade: Grade;
  /** 필기 획 → PNG Blob 변환기(`exportStrokesToPngBlob`)를 주입받는다 — 이 함수 자체는 캔버스 API를
   *  직접 호출하지 않는 순수 함수로 유지하기 위함이다. */
  exportStrokes: (strokes: Stroke[]) => Promise<Blob | null>;
}

/**
 * "풀기" 제출 직전 사진/필기 입력을 공통 제출 모델로 정규화한다.
 * 입력 모드 우선순위: 사진이 있으면 사진을 우선한다(오너 확정) — 사진과 필기가 동시에 있어도
 * 필기는 무시하고 사진만 전송한다. 사진이 없고 필기 획만 있으면 PNG로 export해 사용한다.
 * 둘 다 없으면 `null`(호출 측이 "풀기" 버튼 비활성화로 이 상태 자체를 막는 것이 우선이지만,
 * 방어적으로도 처리한다).
 */
export async function normalizeProblemInput(
  params: NormalizeProblemInputParams,
): Promise<NormalizedProblemInput | null> {
  if (params.photoBlob) {
    return { inputType: "photo", imageBlob: params.photoBlob, grade: params.grade };
  }

  if (params.strokes.length === 0) {
    return null;
  }

  const exportedBlob = await params.exportStrokes(params.strokes);
  if (!exportedBlob) {
    return null;
  }

  return { inputType: "handwriting", imageBlob: exportedBlob, grade: params.grade };
}
