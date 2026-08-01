import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase 환경변수가 설정되지 않았습니다. apps/web/.env.example을 참고해 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요.",
  );
}

/**
 * Supabase 클라이언트 (싱글턴).
 * 세션은 refresh token 메커니즘에 위임한다 — 토큰을 수동으로 localStorage에 저장하지 않는다.
 */
export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
