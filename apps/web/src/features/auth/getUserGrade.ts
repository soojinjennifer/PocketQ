import type { User } from "@supabase/supabase-js";
import type { Grade } from "shared-types";

const GRADES: readonly Grade[] = ["M1", "M2", "M3", "H1", "H2", "H3"];

/**
 * Supabase `user_metadata.grade`를 안전하게 `Grade`로 좁힌다(유효하지 않거나 없으면 `null`).
 * `apps/api/src/middleware/authenticate.ts`의 `extractGrade`와 동일한 판단 기준을 프론트에서도 쓴다.
 */
export function getUserGrade(user: User | null): Grade | null {
  const value: unknown = user?.user_metadata?.["grade"];
  return typeof value === "string" && (GRADES as readonly string[]).includes(value)
    ? (value as Grade)
    : null;
}
