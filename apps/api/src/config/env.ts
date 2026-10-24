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
   * Stage 3부터 solve·resume 라우터가 읽는다(`createSolutionsRouter`/`createResumeRouter`의
   * `figuresEnabled` 기본값): on이면 `**N단계**` 표지를 요청하고 done 뒤 도형을 생성해 `event: figures`로
   * 보낸다. 끄면 프롬프트·SSE가 기존과 바이트 단위로 같다(`docs/API_SPEC.md`).
   */
  figuresEnabled: process.env["FIGURES_ENABLED"] === "true",
  rateLimitMax: readNumber(process.env["RATE_LIMIT_MAX"], 30),
  rateLimitWindowMs: readNumber(process.env["RATE_LIMIT_WINDOW_MS"], 60_000),
} as const;

export const isTestEnv = env.nodeEnv === "test";
