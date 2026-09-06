import { workLinesResponseSchema, type WorkLinesResponseDto } from "validation";
import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, createTimeoutSignal, getAuthHeaders } from "./httpClient";

export interface RecognizeWorkParams {
  problemId: string;
  imageBlob: Blob;
}

function inferFileName(blob: Blob): string {
  if (blob.type === "image/png") return "work.png";
  if (blob.type === "image/webp") return "work.webp";
  return "work.jpg";
}

/**
 * `POST /api/problems/:problemId/work-lines` — `recognizeProblem.ts`와 동일한 패턴으로
 * multipart FormData(`image`)를 담아 줄 단위 학생 풀이 인식을 요청한다.
 */
export async function recognizeWork(params: RecognizeWorkParams): Promise<WorkLinesResponseDto> {
  const formData = new FormData();
  formData.append("image", params.imageBlob, inferFileName(params.imageBlob));

  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(`/api/problems/${params.problemId}/work-lines`), {
    method: "POST",
    headers: authHeaders,
    body: formData,
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "학생 풀이 인식에 실패했습니다.");
  }

  return workLinesResponseSchema.parse(body);
}
