import type { Grade } from "shared-types";
import { recognizeResponseSchema, type RecognizeResponseDto } from "validation";
import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, getAuthHeaders } from "./httpClient";

export interface RecognizeProblemParams {
  imageBlob: Blob;
  inputType: "photo" | "handwriting";
  grade: Grade;
}

function inferFileName(blob: Blob): string {
  if (blob.type === "image/png") return "problem.png";
  if (blob.type === "image/webp") return "problem.webp";
  return "problem.jpg";
}

/** `POST /api/problems/recognize` — multipart FormData(`image`/`inputType`/`grade`)로 문제 인식을 요청한다. */
export async function recognizeProblem(params: RecognizeProblemParams): Promise<RecognizeResponseDto> {
  const formData = new FormData();
  formData.append("image", params.imageBlob, inferFileName(params.imageBlob));
  formData.append("inputType", params.inputType);
  formData.append("grade", params.grade);

  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl("/api/problems/recognize"), {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "문제 인식에 실패했습니다.");
  }

  return recognizeResponseSchema.parse(body);
}
