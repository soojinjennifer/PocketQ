import { getUserGrade } from "../features/auth/getUserGrade";
import { useAuth } from "../features/auth/useAuth";
import { ProblemInputProvider } from "../features/problem-input/ProblemInputProvider";

/**
 * `app` 레이어 전용 조립 컴포넌트 — `features/auth`(인증 사용자)와 `features/problem-input`
 * (문제 입력 Provider)을 연결한다. `.claude/rules/frontend.md`가 feature 간 직접 참조를 금지하므로,
 * "로그인한 사용자의 학년"이라는 두 feature 경계의 값은 `ProblemInputProvider`가 직접 `useAuth`를
 * 호출하는 대신 이 app 레이어 컴포넌트가 조합해서 prop으로 내려준다.
 */
export function ProblemInputRoute() {
  const { user } = useAuth();
  return <ProblemInputProvider grade={getUserGrade(user)} />;
}
