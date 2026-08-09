import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { getRequestUser } from "../shared/lib/request-user";

interface Window {
  count: number;
  resetAt: number;
}

/**
 * 아주 단순한 in-memory sliding(고정) window rate limiter.
 * key는 인증된 user.id를 우선하고, 없으면 IP를 사용한다.
 * 서버 프로세스 재시작 시 카운터는 초기화된다 (분산 환경 대응 아님, 이번 단계 범위 밖).
 */
const windows = new Map<string, Window>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = getRequestUser(req)?.id ?? req.ip ?? "unknown";
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + env.rateLimitWindowMs });
    next();
    return;
  }

  if (existing.count >= env.rateLimitMax) {
    res.status(429).json({
      error: { code: "rate_limited", message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
    });
    return;
  }

  existing.count += 1;
  next();
}
