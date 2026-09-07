import type { CasStepVerification, WorkLine } from "shared-types";
import { AppError } from "../../shared/errors/AppError";

/**
 * CAS(Computer Algebra System) 검증 클라이언트 인터페이스.
 * `resolveCasClient()`가 `CAS_SERVICE_URL` 설정 여부에 따라 이 인터페이스의 실제 HTTP 구현
 * (`HttpCasClient`) 또는 기존 스텁 기반 폴백 구현 중 하나를 반환한다.
 */
export interface CasClient {
  /** DIAG-1 대응 — 학생 풀이 각 줄의 수학적 타당성을 순서대로 검증한다. */
  verifyWorkLines(lines: WorkLine[]): Promise<CasStepVerification[]>;
  /** RESUME-5 대응 — 이어풀기 최종 답이 원 문제의 정답과 대수적으로 동치인지 검증한다. */
  verifyFinalAnswer(
    problemAnswerLatex: string,
    solutionAnswerLatex: string,
  ): Promise<{ verified: boolean }>;
}

interface VerifyWorkLinesResponseBody {
  results: CasStepVerification[];
}

interface VerifyFinalAnswerResponseBody {
  verified: boolean;
}

/**
 * `services/cas/`(Python + FastAPI + SymPy) 서비스에 실제 HTTP로 위임하는 클라이언트.
 * `openai-adapter.ts`가 `openai` SDK를 참조하는 유일한 파일이듯, 이 파일이 CAS 서비스의
 * HTTP 계약(요청/응답 형태)을 아는 유일한 파일이다 — 다른 어떤 파일도 fetch로 CAS 서비스를
 * 직접 호출하지 않는다.
 */
export class HttpCasClient implements CasClient {
  constructor(private readonly baseUrl: string) {}

  async verifyWorkLines(lines: WorkLine[]): Promise<CasStepVerification[]> {
    const body = {
      lines: lines.map((line) => ({ lineNo: line.lineNo, latex: line.latex })),
    };

    const response = await this.post("/verify-work-lines", body);
    const data = (await this.parseJson(response)) as VerifyWorkLinesResponseBody;

    return data.results;
  }

  async verifyFinalAnswer(
    problemAnswerLatex: string,
    solutionAnswerLatex: string,
  ): Promise<{ verified: boolean }> {
    const response = await this.post("/verify-final-answer", {
      problemAnswerLatex,
      solutionAnswerLatex,
    });
    const data = (await this.parseJson(response)) as VerifyFinalAnswerResponseBody;

    return { verified: data.verified };
  }

  private async post(path: string, body: unknown): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AppError("provider_error", "CAS 서비스에 연결할 수 없습니다.", 502);
    }

    if (!response.ok) {
      throw new AppError(
        "provider_error",
        `CAS 서비스가 오류 응답을 반환했습니다 (status: ${response.status}).`,
        502,
      );
    }

    return response;
  }

  private async parseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new AppError("provider_error", "CAS 서비스 응답을 해석하지 못했습니다.", 502);
    }
  }
}
