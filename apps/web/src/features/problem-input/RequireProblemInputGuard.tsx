import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useProblemInput } from "./useProblemInput";

interface RequireProblemInputGuardProps {
  children: ReactNode;
}

/**
 * `/solve/landscape`는 이미 사진/필기 입력이 있는 상태에서 `/solve/pencilcanvas`의 "풀기"를 눌러
 * 들어오는 화면이다. 새로고침이나 딥링크로 사진/필기 데이터 없이 직접 진입하면(오너 확정: 이번 MVP는
 * 새로고침 시 메모리 상태 유실을 허용) 입력을 다시 만들 수 있는 `/camera`로 되돌린다.
 */
export function RequireProblemInputGuard({ children }: RequireProblemInputGuardProps) {
  const { hasProblemInput } = useProblemInput();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasProblemInput) {
      void navigate("/camera", { replace: true });
    }
  }, [hasProblemInput, navigate]);

  if (!hasProblemInput) {
    return null;
  }

  return <>{children}</>;
}
