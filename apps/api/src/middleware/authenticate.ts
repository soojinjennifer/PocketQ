import type { NextFunction, Request, Response } from "express";
import type { Grade } from "shared-types";
import { getSupabaseServerClient } from "../infrastructure/supabase/client";
import { setRequestUser } from "../shared/lib/request-user";

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return undefined;
  return token;
}

function extractGrade(value: unknown): Grade | undefined {
  const grades: readonly Grade[] = ["M1", "M2", "M3", "H1", "H2", "H3"];
  return typeof value === "string" && (grades as readonly string[]).includes(value)
    ? (value as Grade)
    : undefined;
}

/**
 * Authorization: Bearer <token> 헤더를 Supabase(service role client)로 검증하고
 * 성공 시 req.user = { id, grade }를 채운다. 실패 시 401을 응답한다.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req.header("authorization"));

  if (!token) {
    res.status(401).json({ error: { code: "unauthorized", message: "인증 토큰이 없습니다." } });
    return;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: { code: "unauthorized", message: "유효하지 않은 인증 토큰입니다." } });
    return;
  }

  setRequestUser(req, {
    id: data.user.id,
    grade: extractGrade(data.user.user_metadata?.["grade"]),
  });
  next();
}
