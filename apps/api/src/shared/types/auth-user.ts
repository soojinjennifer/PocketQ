import type { Grade } from "shared-types";

/**
 * authenticate 미들웨어가 채우는 인증된 사용자 정보.
 * grade는 Supabase user_metadata.grade에서 추출하며, 없을 수 있다.
 */
export interface AuthenticatedUser {
  id: string;
  grade?: Grade;
}
