import { Router, type NextFunction, type Request, type Response } from "express";
import type { RecognizedProblem } from "shared-types";
import { solveRequestSchema, type SolveRequestDto } from "validation";
import { authenticate } from "../../middleware/authenticate";
import { rateLimiter } from "../../middleware/rate-limiter";
import { validateRequest } from "../../middleware/validate-request";
import { AppError } from "../../shared/errors/AppError";
import { resolveAdapter } from "../../infrastructure/ai/resolve-adapter";
import { inMemoryProblemStore } from "../../infrastructure/store/inMemoryProblemStore";

export const solutionsRouter: Router = Router();

function resolveProblem(problemId: string, confirmedText: string | undefined): RecognizedProblem {
  const stored = inMemoryProblemStore.get(problemId);

  if (!stored) {
    throw new AppError("validation_error", `문제(${problemId})를 찾을 수 없습니다.`, 404);
  }

  if (confirmedText !== undefined) {
    return { recognizedText: confirmedText, recognizedLatex: stored.problem.recognizedLatex };
  }

  return stored.problem;
}

async function handleSolve(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { problemId } = req.params as { problemId: string };
  const { options, confirmedText } = req.body as SolveRequestDto;

  let problem: RecognizedProblem;
  try {
    problem = resolveProblem(problemId, confirmedText);
  } catch (error) {
    next(error);
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    for await (const event of resolveAdapter().solve({ problem, options })) {
      if ("delta" in event) {
        res.write(`event: chunk\ndata: ${JSON.stringify({ delta: event.delta })}\n\n`);
      } else {
        res.write(`event: done\ndata: ${JSON.stringify(event.result)}\n\n`);
      }
    }
  } catch {
    res.write(
      `event: error\ndata: ${JSON.stringify({ code: "provider_error", message: "풀이 생성 중 오류가 발생했습니다." })}\n\n`,
    );
  } finally {
    res.end();
  }
}

solutionsRouter.post(
  "/problems/:problemId/solve",
  authenticate,
  rateLimiter,
  validateRequest(solveRequestSchema),
  handleSolve,
);
