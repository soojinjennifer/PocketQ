import type { AiProvider } from "shared-types";

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(value: string | undefined, fallback: string): string {
  return value === undefined || value === "" ? fallback : value;
}

function readAiGateway(value: string | undefined): "runyour" | undefined {
  return value === "runyour" ? value : undefined;
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
   * OpenAI 호환 게이트웨이 선택. 정확히 "runyour"일 때만 `AI_PROVIDER=openai` 어댑터가 OpenAI 대신
   * Runyour(`RUNYOUR_BASE_URL`)로 같은 Responses API 요청을 보낸다. 비우면 OpenAI 직접 호출(기존 동작).
   * 원복은 이 값을 비우고 `AI_MODEL`을 이전 OpenAI 모델로 되돌리면 된다.
   */
  aiGateway: readAiGateway(process.env["AI_GATEWAY"]),
  runyourApiKey: process.env["RUNYOUR_API_KEY"] ?? "",
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
  /**
   * 검증된 도형을 solutions 행에 저장·재조회하는 플래그(Stage 5, `docs/FIGURE_SPEC.md` §8). 정확히 "true"일 때만 on.
   * on이어도 첫 사용 시 `20261025000000_solution_figures.sql`의 컬럼을 탐지하지 못하면 도형 키를 쓰거나 읽지 않는다
   * (`problemRepository.figureColumnsAvailable`). off면 저장 payload·상세 select·응답이 기존과 바이트 단위로 같다.
   */
  figuresPersistEnabled: process.env["FIGURES_PERSIST_ENABLED"] === "true",
  /**
   * CAS 검증을 통과한 이어풀기 결과를 `resume_solutions`에 저장하고 상세 조회에 `resumeSolution`으로 돌려주는 플래그
   * (Stage 5). 정확히 "true"일 때만 on. on이어도 `20261025000100_resume_solutions.sql`의 테이블을 탐지하지 못하면
   * 저장·조회하지 않는다(`problemRepository.resumeTableAvailable`). off면 resume 라우터의 저장소 호출 0.
   */
  resumePersistEnabled: process.env["RESUME_PERSIST_ENABLED"] === "true",
  rateLimitMax: readNumber(process.env["RATE_LIMIT_MAX"], 30),
  rateLimitWindowMs: readNumber(process.env["RATE_LIMIT_WINDOW_MS"], 60_000),
} as const;

export const isTestEnv = env.nodeEnv === "test";
