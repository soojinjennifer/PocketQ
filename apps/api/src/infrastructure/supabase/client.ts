import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env";

/**
 * 서버 전용 Supabase 클라이언트 (service role key 사용).
 * apps/web의 anon key 클라이언트와는 완전히 별개의 인스턴스이며,
 * 여기서는 토큰 검증(auth.getUser) 용도로만 사용한다.
 */
let cachedClient: SupabaseClient | undefined;

export function getSupabaseServerClient(): SupabaseClient {
  cachedClient ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}
