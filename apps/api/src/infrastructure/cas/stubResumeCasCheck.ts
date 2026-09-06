// TODO: CAS_SERVICE_URL(Python/SymPy 별도 서비스) 준비되면 실제 HTTP 호출로 교체
import type { ResumeSolution } from "shared-types";

/**
 * 실제 CAS(Computer Algebra System) 검증 서비스가 준비되기 전까지, 이어풀기(RESUME) 결과의
 * 최종 답을 무조건 `{ verified: true }`로 반환하는 순수 함수 스텁이다(`stubCasVerification.ts`와
 * 동일한 패턴/제약). `resume.router.ts`가 스트리밍 완료(`done`) 이벤트 직전에 호출해
 * `ResumeSolution.verified` 값을 채우는 데 사용한다.
 */
export function stubResumeCasCheck(_solution: ResumeSolution): { verified: true } {
  return { verified: true };
}
