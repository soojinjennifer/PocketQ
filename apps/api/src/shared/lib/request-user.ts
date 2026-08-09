import type { Request } from "express";
import type { AuthenticatedUser } from "../types/auth-user";

/**
 * req에 인증된 사용자 정보를 부착/조회하기 위한 헬퍼.
 *
 * express-serve-static-core에 대한 전역 Request 모듈 증강은 pnpm의 격리된
 * node_modules 구조에서 해당 패키지가 apps/api에서 직접 해석되지 않아 동작하지
 * 않으므로, 로컬 타입 단언으로 대체한다 (any는 사용하지 않는다).
 */
type RequestWithUser = Request & { user?: AuthenticatedUser };

export function setRequestUser(req: Request, user: AuthenticatedUser): void {
  (req as RequestWithUser).user = user;
}

export function getRequestUser(req: Request): AuthenticatedUser | undefined {
  return (req as RequestWithUser).user;
}
