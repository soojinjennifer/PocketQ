import cors from "cors";
import express, { type Express } from "express";
import { corsOptions } from "./config/cors";
import type { LLMAdapter } from "./infrastructure/ai/adapter";
import { resolveAdapter } from "./infrastructure/ai/resolve-adapter";
import { errorHandler } from "./middleware/error-handler";
import { createChatRouter } from "./modules/chat/chat.router";
import { createDiagnosisRouter } from "./modules/diagnosis/diagnosis.router";
import { healthRouter } from "./modules/health/health.router";
import { createProblemsRouter } from "./modules/problems/problems.router";
import { createRecognitionRouter } from "./modules/recognition/recognition.router";
import { createResumeRouter } from "./modules/resume/resume.router";
import { createSolutionsRouter } from "./modules/solutions/solutions.router";
import { createSuggestionsRouter } from "./modules/suggestions/suggestions.router";
import { createWorkRouter } from "./modules/work/work.router";

/**
 * Express 앱 구성. 미들웨어·라우트 등록만 담당하고 서버 실행은 server.ts가 맡는다.
 *
 * `adapter`를 생략하면(운영 기본값) 여기서 `resolveAdapter()`를 단 한 번만 호출해
 * recognize/solve 라우트가 동일한 어댑터 인스턴스를 공유한다(예: OpenAI 클라이언트 중복 생성 방지).
 * 테스트는 `createApp(new FakeLLMAdapter())`처럼 명시적으로 주입해 실제 `AI_PROVIDER`
 * 환경변수나 실제 API 호출과 무관하게 동작한다.
 */
export function createApp(adapter: LLMAdapter = resolveAdapter()): Express {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json());

  app.use(healthRouter);
  app.use("/api", createRecognitionRouter(adapter));
  app.use("/api", createSolutionsRouter(adapter));
  app.use("/api", createChatRouter(adapter));
  app.use("/api", createSuggestionsRouter(adapter));
  app.use("/api", createProblemsRouter());
  app.use("/api", createWorkRouter(adapter));
  app.use("/api", createDiagnosisRouter(adapter));
  app.use("/api", createResumeRouter(adapter));

  app.use(errorHandler);

  return app;
}
