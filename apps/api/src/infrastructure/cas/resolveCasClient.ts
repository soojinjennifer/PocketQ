import type { CasStepVerification, WorkLine } from "shared-types";
import { env } from "../../config/env";
import { type CasClient, HttpCasClient } from "./casClient";
import { stubCasVerification } from "./stubCasVerification";
import { stubResumeCasCheck } from "./stubResumeCasCheck";

/**
 * 라우트가 실제로 사용할 CAS 클라이언트를 결정한다 — `resolveAdapter()`(infrastructure/ai)와
 * 동일한 원칙이다.
 *
 * `CAS_SERVICE_URL` 환경변수가 비어 있으면(로컬 개발/테스트 등 CAS 서비스가 아직 없는 환경)
 * 기존 결정론적 스텁(`stubCasVerification`/`stubResumeCasCheck`)으로 안전하게 폴백하는 객체를
 * 반환한다 — 두 스텁은 삭제하지 않고 그대로 유지되므로 그 단위 테스트도 계속 통과한다.
 * 설정돼 있으면 `services/cas/`(Python + FastAPI + SymPy)를 실제로 호출하는 `HttpCasClient`를
 * 반환한다.
 */
export function resolveCasClient(): CasClient {
  if (!env.casServiceUrl) {
    return {
      verifyWorkLines(lines: WorkLine[]): Promise<CasStepVerification[]> {
        return Promise.resolve(stubCasVerification(lines));
      },
      verifyFinalAnswer(
        _problemAnswerLatex: string,
        solutionAnswerLatex: string,
      ): Promise<{ verified: boolean }> {
        // `stubResumeCasCheck`는 인자 내용과 무관하게 항상 `{ verified: true }`를 반환하므로
        // 나머지 필드는 이 경로에서 의미가 없다 — `answerMd`만 실제 값을 채워 넣는다.
        return Promise.resolve(
          stubResumeCasCheck({
            mode: "own",
            methodName: "",
            solutionMd: "",
            answerMd: solutionAnswerLatex,
            verified: false,
          }),
        );
      },
    };
  }

  return new HttpCasClient(env.casServiceUrl);
}
