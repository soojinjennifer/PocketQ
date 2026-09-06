import { diagnoseResponseSchema, type DiagnoseResponseDto } from "validation";
import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, createTimeoutSignal, getAuthHeaders } from "./httpClient";

export interface DiagnoseProblemWorkLine {
  lineNo: number;
  latex: string;
}

export interface DiagnoseProblemParams {
  problemId: string;
  /** 클라이언트가 확인/수정한 줄만 보낸다(인식 메타데이터인 `isLowConfidence`는 제외). */
  workLines: DiagnoseProblemWorkLine[];
}

/**
 * `POST /api/problems/:problemId/diagnose` — 학생 풀이 진단을 요청한다. `sendChatMessage`와
 * 동일하게 SSE가 아니라 일반 JSON 완료 응답이라 단발성 fetch 패턴을 따른다.
 */
export async function diagnoseProblem(params: DiagnoseProblemParams): Promise<DiagnoseResponseDto> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(`/api/problems/${params.problemId}/diagnose`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ workLines: params.workLines }),
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "진단 결과를 받지 못했습니다.");
  }

  return diagnoseResponseSchema.parse(body);
}
