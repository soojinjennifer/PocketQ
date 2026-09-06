import { Router, type NextFunction, type Request, type Response } from "express";
import type { Grade, WorkLine } from "shared-types";
import { diagnoseRequestSchema, diagnoseResponseSchema, type DiagnoseRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { stubCasVerification } from "../../infrastructure/cas/stubCasVerification";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";
import { getRequestUser } from "../../shared/lib/request-user";

interface ResolvedDiagnoseContext {
  problemText: string;
  grade: Grade;
}

/**
 * `problemId`로 저장소에서 문제 원문/학년을 조회한다. `chat.router.ts`의 `resolveChatContext`와
 * 동일한 소유권 검증 규칙(대상 없거나 다른 사용자 소유면 404)을 따른다.
 */
function resolveDiagnoseContext(problemId: string, userId: string): ResolvedDiagnoseContext {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored || stored.userId !== userId) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  return { problemText: stored.problem.recognizedText, grade: stored.grade };
}

function createHandleDiagnose(adapter: LLMAdapter) {
  return async function handleDiagnose(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { problemId } = req.params as { problemId: string };
    const { workLines: requestWorkLines } = req.body as DiagnoseRequestDto;

    const userId = getRequestUser(req)?.id;
    if (!userId) {
      next(new AppError("unauthorized", "인증이 필요합니다.", 401));
      return;
    }

    try {
      const { problemText, grade } = resolveDiagnoseContext(problemId, userId);

      // 클라이언트가 확인/수정한 줄만 보내므로 진단 시점의 인식 메타데이터(`isLowConfidence`)는
      // 더 이상 유효하지 않다 — 확정된 값으로 간주해 false로 채운다.
      const workLines: WorkLine[] = requestWorkLines.map((line) => ({
        ...line,
        isLowConfidence: false,
      }));
      const casVerification = stubCasVerification(workLines);

      const diagnosis = await adapter.diagnose({ problem: problemText, workLines, casVerification, grade });
      inMemoryProblemStore.setDiagnosis(problemId, diagnosis);

      const responseBody = diagnoseResponseSchema.parse(diagnosis);
      res.status(200).json(responseBody);
    } catch (error) {
      next(error);
    }
  };
}

/** `createChatRouter`와 동일한 이유로 adapter를 주입 가능하게 한다. */
export function createDiagnosisRouter(adapter: LLMAdapter = resolveAdapter()): Router {
  const router = Router();

  router.post(
    "/problems/:problemId/diagnose",
    authenticate,
    rateLimiter,
    validateRequest(diagnoseRequestSchema),
    createHandleDiagnose(adapter),
  );

  return router;
}
