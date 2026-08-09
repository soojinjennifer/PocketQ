import type { CorsOptions } from "cors";
import { env } from "./env";

/**
 * CORS_ORIGIN은 쉼표로 구분된 origin 목록을 지원한다 (예: "http://localhost:5173,https://app.whymath.kr").
 */
export const corsOptions: CorsOptions = {
  origin: env.corsOrigin.split(",").map((origin) => origin.trim()),
  credentials: true,
};
