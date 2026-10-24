import type { AiProvider } from "shared-types";

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(value: string | undefined, fallback: string): string {
  return value === undefined || value === "" ? fallback : value;
}

function readAiProvider(value: string | undefined): AiProvider | undefined {
  return value === "openai" || value === "claude" ? value : undefined;
}

/**
 * 환경변수를 한 곳에서 읽고 기본값을 적용한다.
 * 실제 시크릿 값은 .env(로컬 전용)에서만 채워지며, .env.example에는 빈 값만 둔다.
 */
export const env = {
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  port: readNumber(process.env["PORT"], 4000),
  corsOrigin: readString(process.env["CORS_ORIGIN"], "http://localhost:5173"),
  supabaseUrl: process.env["SUPABASE_URL"] ?? "",
  supabaseServiceRoleKey: process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
  aiProvider: readAiProvider(process.env["AI_PROVIDER"]),
  aiModel: process.env["AI_MODEL"] ?? "",
  anthropicApiKey: process.env["ANTHROPIC_API_KEY"] ?? "",
  openaiApiKey: process.env["OPENAI_API_KEY"] ?? "",
  /**
   * CAS(Computer Algebra System, Python/SymPy 별도 서비스)의 base URL.
   * 빈 문자열이면 "미설정"으로 간주해 `resolveCasClient()`가 기존
   * `stubCasVerification`/`stubResumeCasCheck`로 폴백한다(로컬 개발 환경에서 CAS 서비스를
   * 띄우지 않아도 기존 동작이 그대로 유지된다).
   */
  casServiceUrl: process.env["CAS_SERVICE_URL"] ?? "",
  /**
   * 도형 시각화(PRD §4.12 FIG) 기능 플래그. 정확히 문자열 "true"일 때만 켜진다(기본 off).
   * Stage 1에서는 값만 정의하고 어떤 실행 경로도 이 값을 읽지 않는다 — Stage 3부터 풀이 API가
   * 이 값이 true일 때만 figures를 생성·반환한다. 끄면 기존 텍스트 풀이 흐름 그대로다.
   */
  figuresEnabled: process.env["FIGURES_ENABLED"] === "true",
  rateLimitMax: readNumber(process.env["RATE_LIMIT_MAX"], 30),
  rateLimitWindowMs: readNumber(process.env["RATE_LIMIT_WINDOW_MS"], 60_000),
} as const;

export const isTestEnv = env.nodeEnv === "test";
