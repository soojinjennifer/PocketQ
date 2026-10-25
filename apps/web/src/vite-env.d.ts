/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL: string;
  /**
   * 도형 시각화 화면(Stage 4). 빌드 시점 값이고 정확히 "true"일 때만 결과 패널이 도형 슬롯을 지연 로딩한다.
   * 미설정이면 도형 UI·JSXGraph 청크가 빌드에서 빠진다. 서버 `FIGURES_ENABLED`와의 조합은 `docs/DEPLOYMENT.md`.
   */
  readonly VITE_FIGURES_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
