// TODO: CAS_SERVICE_URL(Python/SymPy 별도 서비스) 준비되면 실제 HTTP 호출로 교체
import type { CasStepVerification, WorkLine } from "shared-types";

/**
 * 실제 CAS(Computer Algebra System) 검증 서비스가 준비되기 전까지, 모든 줄을 무조건
 * `isValid: true`로 반환하는 순수 함수 스텁이다. `diagnosis.router.ts`가 `diagnose()` 어댑터
 * 호출 전에 CAS 검증 결과를 만들기 위해 사용한다.
 */
export function stubCasVerification(workLines: WorkLine[]): CasStepVerification[] {
  return workLines.map((line) => ({ lineNo: line.lineNo, isValid: true }));
}
