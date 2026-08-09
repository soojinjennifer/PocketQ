import cors from "cors";
import express, { type Express } from "express";
import { corsOptions } from "./config/cors";
import { errorHandler } from "./middleware/error-handler";
import { healthRouter } from "./modules/health/health.router";
import { recognitionRouter } from "./modules/recognition/recognition.router";
import { solutionsRouter } from "./modules/solutions/solutions.router";

/**
 * Express 앱 구성. 미들웨어·라우트 등록만 담당하고 서버 실행은 server.ts가 맡는다.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json());

  app.use(healthRouter);
  app.use("/api", recognitionRouter);
  app.use("/api", solutionsRouter);

  app.use(errorHandler);

  return app;
}
