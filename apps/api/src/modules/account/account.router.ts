import { Router, type NextFunction, type Request, type Response } from "express";
import { hasSignupConsentMetadata } from "validation";
import { getSupabaseServerClient } from "../../infrastructure/supabase/client";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { AppError } from "../../shared/errors/AppError";
import { getRequestUser } from "../../shared/lib/request-user";

/**
 * `DELETE /api/account/unconsented` — 가입 동의 게이트에서 "만 14세 미만이에요"를 고른 사용자의 계정 삭제(PRD AUTH-11, D5).
 *
 * 1. 토큰의 사용자 id로 서버(service role)에서 사용자를 다시 읽는다. 클라이언트가 보낸 상태를 믿지 않는다.
 * 2. 웹 게이트와 같은 규칙(`validation`의 `hasSignupConsentMetadata`: 세 동의 일시가 모두 비어 있지 않은 문자열)으로
 *    동의 완료 계정이면 409로 거부하고 아무것도 지우지 않는다. 그래서 게이트가 보이는 사용자는 항상 삭제할 수 있다.
 * 3. 없으면 `auth.admin.deleteUser`로 계정을 지운다. 학습 기록(`problems` 등)은 FK `on delete cascade`로 함께 지워진다.
 * 4. 204(본문 없음)로 응답한다.
 *
 * Supabase 원본 오류는 서버 로그에만 남기고 클라이언트에는 일반 메시지만 보낸다.
 */
async function handleDeleteUnconsentedAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getRequestUser(req)?.id;
  if (!userId) {
    next(new AppError("unauthorized", "인증이 필요합니다.", 401));
    return;
  }

  const admin = getSupabaseServerClient().auth.admin;

  const { data, error: readError } = await admin.getUserById(userId);
  if (readError || !data.user) {
    console.error("[account.router] getUserById 실패", readError);
    next(new AppError("internal_error", "계정 정보를 확인하지 못했습니다.", 500));
    return;
  }

  if (hasSignupConsentMetadata(data.user.user_metadata)) {
    next(new AppError("conflict", "이미 가입 동의가 기록된 계정입니다.", 409));
    return;
  }

  const { error: deleteError } = await admin.deleteUser(userId);
  if (deleteError) {
    console.error("[account.router] deleteUser 실패", deleteError);
    next(new AppError("internal_error", "계정 정보를 삭제하지 못했습니다.", 500));
    return;
  }

  res.status(204).end();
}

/** 계정 관리 라우터. AI 어댑터를 쓰지 않는다. */
export function createAccountRouter(): Router {
  const router = Router();

  router.delete("/account/unconsented", authenticate, rateLimiter, handleDeleteUnconsentedAccount);

  return router;
}
