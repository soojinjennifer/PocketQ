import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useProblemInput } from "./useProblemInput";

interface RequireProblemInputGuardProps {
  children: ReactNode;
}

/**
 * `/solve/landscape`는 이미 사진/필기 입력이 있는 상태에서 `/solve/pencilcanvas`의 "풀기"를 눌러
 * 들어오는 화면이다. 새로고침이나 딥링크로 사진/필기 데이터 없이 직접 진입하면(오너 확정: 이번 MVP는
 * 새로고침 시 메모리 상태 유실을 허용) 입력을 다시 만들 수 있는 `/camera`로 되돌린다.
 *
 * 예외 1 — 마이페이지 "다시 풀기"(`location.state.resumeProblemId`): 사진/필기 없이 저장된 인식
 * 결과만으로 진입하는 정상 경로다. 재수화는 자식(`SolveLandscapePage`)이 트리거하지만, 이 가드가
 * 부모라 첫 렌더에서 자식보다 먼저 평가되고 그 시점에는 `hasProblemInput`/`problemId`가 모두 비어
 * 있어 자식이 마운트되기도 전에 `/camera`로 튕겨버린다. 그래서 가드가 `location.state`를 직접 확인해
 * 이 경쟁 상태를 피한다.
 *
 * 예외 2 — 이미 시작된 제출 세션(`problemId`가 있거나 `recognizeStatus`가 `idle`이 아님): 재수화(또는
 * 일반 recognize)가 성공한 뒤에는 사진 Blob이 정리돼 `hasProblemInput`이 false가 될 수 있고, "다시
 * 풀기"는 `location.state`를 한 번 소비한 뒤 즉시 비우기 때문에(중복 트리거 방지,
 * `SolveLandscapePage` 참고) 인식 응답이 도착하기 전까지 세 조건이 모두 비는 순간이 생긴다. 진행 중인
 * 세션이 그 틈에 `/camera`로 튕기지 않도록 `recognizeStatus`도 함께 본다(딥링크 직접 진입은 여전히
 * `idle`이라 기존 리다이렉트 동작은 그대로다).
 */
export function RequireProblemInputGuard({ children }: RequireProblemInputGuardProps) {
  const { hasProblemInput, problemId, recognizeStatus } = useProblemInput();
  const navigate = useNavigate();
  const location = useLocation();

  const resumeProblemId = (location.state as { resumeProblemId?: string } | null)?.resumeProblemId;
  const isAllowed =
    hasProblemInput || problemId !== null || recognizeStatus !== "idle" || Boolean(resumeProblemId);

  useEffect(() => {
    if (!isAllowed) {
      void navigate("/camera", { replace: true });
    }
  }, [isAllowed, navigate]);

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
}
