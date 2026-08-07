import type { User } from "@supabase/supabase-js";

export type PostAuthDestination = "/grade-setup" | "/solve/pencilcanvas";

/**
 * 로그인/인증 후 이동할 목적지를 user_metadata.grade 존재 여부로 판단하는 단일 기준 함수.
 * 학년이 설정되어 있지 않으면 /grade-setup, 설정되어 있으면 /solve/pencilcanvas로 이동시킨다.
 * 이 판단 로직은 이 파일에서만 구현하고 다른 곳에서는 반드시 이 함수를 재사용한다.
 */
export function getPostAuthDestination(user: User | null): PostAuthDestination {
  const grade: unknown = user?.user_metadata?.grade;
  return typeof grade === "string" && grade.length > 0 ? "/solve/pencilcanvas" : "/grade-setup";
}
