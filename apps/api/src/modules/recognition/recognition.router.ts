import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { recognizeRequestSchema, recognizeResponseSchema, type RecognizeRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { problemRepository } from "../../infrastructure/persistence/problemRepository";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";
import { uploadProblemImage } from "./upload";

/** 소프트 캡(오너 확정): 하루 10회, 매일 자정 UTC 리셋. 초과해도 인식 자체를 차단하지 않는다. */
const DAILY_RECOGNIZE_LIMIT = 10;

function requireImageFile(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
    return;
  }
  next();
}

/**
 * 성능 계측 전용 로컬 상태(이 라우터 파일 안에서만 쓰인다). 공유 미들웨어(`authenticate`,
 * `uploadProblemImage`)나 `Request` 타입 자체는 건드리지 않고, `req` 객체를 key로 하는
 * `WeakMap`에 구간별 소요시간만 별도로 쌓아둔다 — 요청이 끝나 `req`가 GC되면 항목도 함께
 * 사라지므로 별도 정리(cleanup)가 필요 없다.
 */
interface RequestTimingState {
  authMs?: number;
  uploadMs?: number;
}

const requestTimingState = new WeakMap<Request, RequestTimingState>();

function elapsedMs(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

/** 라우터 체인 맨 앞에서 이 요청의 계측 상태를 초기화한다. */
function attachTimings(req: Request, _res: Response, next: NextFunction): void {
  requestTimingState.set(req, {});
  next();
}

/**
 * `authenticate`/`uploadProblemImage`(공유 미들웨어) 자체는 수정하지 않고, 진입~`next()` 호출
 * 사이의 소요시간만 로컬로 감싸서 잰다. 두 미들웨어 모두 성공/실패 상관없이 `next(err?)`를
 * 정확히 한 번 호출하는 계약을 지키므로, 그 호출 시점을 구간 종료로 삼아도 안전하다.
 */
function timeMiddleware(field: keyof RequestTimingState, middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    middleware(req, res, (err?: unknown) => {
      const state = requestTimingState.get(req);
      if (state) {
        state[field] = elapsedMs(startedAt);
      }
      next(err);
    });
  };
}

/**
 * 인증된 사용자의 소프트 캡 조회는 best-effort다 — 실패해도(또는 인증 사용자 id가 없어도)
 * throw하지 않고 `undefined`를 반환할 뿐이다. `Promise.all`로 `saveProblem`과 함께 묶어 쓸 수
 * 있도록 에러 흡수 로직을 별도 async 함수로 분리했다.
 */
async function lookupDailyUsageCount(userId: string): Promise<number | undefined> {
  if (userId === "unknown") {
    return undefined;
  }
  try {
    return await problemRepository.countProblemsCreatedToday(userId);
  } catch (error) {
    console.error("[recognition.router] countProblemsCreatedToday 실패", error);
    return undefined;
  }
}

function createHandleRecognize(adapter: LLMAdapter) {
  return async function handleRecognize(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = randomUUID();
    const requestStartedAt = process.hrtime.bigint();
    let inputBytes: number | undefined;
    let processedBytes: number | undefined;
    let openaiMs: number | undefined;
    let usageLookupMs: number | undefined;
    let persistenceMs: number | undefined;

    try {
      // validateRequest 미들웨어가 이미 검증·치환한 값이므로 안전하게 단언한다.
      const { grade, inputType } = req.body as RecognizeRequestDto;
      const imageBuffer = req.file?.buffer;

      if (!imageBuffer) {
        next(new AppError("validation_error", "이미지 파일(image)이 필요합니다.", 400));
        return;
      }

      inputBytes = imageBuffer.length;
      // OpenAI adapter가 실제로 전송하는 payload(`data:image/jpeg;base64,<...>`)의 base64 부분과
      // 동일한 인코딩 결과이므로, 어댑터 내부를 건드리지 않고도 실제 전송 크기를 그대로 잰다.
      processedBytes = imageBuffer.toString("base64").length;

      const openaiStartedAt = process.hrtime.bigint();
      const recognized = await adapter.recognizeProblem(imageBuffer, grade);
      openaiMs = elapsedMs(openaiStartedAt);

      const problemId = randomUUID();
      const createdAt = new Date().toISOString();

      const userId = getRequestUser(req)?.id ?? "unknown";

      inMemoryProblemStore.set({
        problemId,
        userId,
        grade,
        problem: recognized,
        createdAt,
      });

      const persistenceStartedAt = process.hrtime.bigint();
      const usageLookupStartedAt = process.hrtime.bigint();

      // Supabase 영구 저장(saveProblem)과 소프트 캡 안내용 카운트 조회(countProblemsCreatedToday)는
      // 서로의 결과값을 참조하지 않는 독립적인 호출이라 병렬로 처리한다. saveProblem은 이미 자체
      // best-effort(throw하지 않음)이고, countProblemsCreatedToday는 `lookupDailyUsageCount`가
      // 동일하게 에러를 흡수하므로 `Promise.all`로 묶어도 인식 자체가 막히지 않는다.
      const [, usageCount] = await Promise.all([
        // Supabase 영구 저장은 best-effort다 — 실패해도 throw하지 않으므로 응답에 영향이 없다.
        problemRepository
          .saveProblem({
            problemId,
            userId,
            grade,
            inputType,
            problem: recognized,
            createdAt,
          })
          .finally(() => {
            persistenceMs = elapsedMs(persistenceStartedAt);
          }),
        // 소프트 캡(하루 10회, 오너 확정) 안내용 카운트. 인식 자체는 절대 막지 않는다 — 조회가
        // 실패해도(또는 인증 사용자 id가 없어도) 그냥 값을 생략할 뿐, recognize 응답은 그대로
        // 200으로 성공 처리한다.
        lookupDailyUsageCount(userId).finally(() => {
          usageLookupMs = elapsedMs(usageLookupStartedAt);
        }),
      ]);

      let dailyUsageCount: number | undefined;
      let dailyUsageLimit: number | undefined;
      if (usageCount !== undefined) {
        dailyUsageCount = usageCount;
        dailyUsageLimit = DAILY_RECOGNIZE_LIMIT;
      }

      const responseBody = recognizeResponseSchema.parse({
        problemId,
        recognizedText: recognized.recognizedText,
        recognizedLatex: recognized.recognizedLatex,
        createdAt,
        dailyUsageCount,
        dailyUsageLimit,
      });

      res.status(200).json(responseBody);
    } catch (error) {
      next(error);
    } finally {
      const timingState = requestTimingState.get(req);
      console.log(
        JSON.stringify({
          requestId,
          authMs: timingState?.authMs,
          uploadMs: timingState?.uploadMs,
          openaiMs,
          usageLookupMs,
          persistenceMs,
          totalMs: elapsedMs(requestStartedAt),
          inputBytes,
          processedBytes,
        }),
      );
    }
  };
}

/**
 * `adapter`를 명시적으로 주입할 수 있게 해서 테스트가 실제 provider 환경변수와 무관하게
 * `FakeLLMAdapter`를 결정적으로 사용할 수 있게 한다. 인자를 생략하면(운영 기본값)
 * `resolveAdapter()`가 `AI_PROVIDER` 환경변수를 보고 실제 어댑터를 고른다.
 */
export function createRecognitionRouter(adapter: LLMAdapter = resolveAdapter()): Router {
  const router = Router();

  router.post(
    "/problems/recognize",
    attachTimings,
    timeMiddleware("authMs", authenticate),
    rateLimiter,
    timeMiddleware("uploadMs", uploadProblemImage),
    requireImageFile,
    validateRequest(recognizeRequestSchema),
    createHandleRecognize(adapter),
  );

  return router;
}
