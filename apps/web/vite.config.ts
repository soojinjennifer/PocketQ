import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const certDir = fileURLToPath(new URL("./.cert", import.meta.url));
const keyPath = `${certDir}/key.pem`;
const certPath = `${certDir}/cert.pem`;
// iPad 등 LAN 기기에서 카메라(getUserMedia)를 테스트하려면 HTTPS가 필요하다(HTTP+IP는 non-secure
// context로 취급되어 getUserMedia가 비활성화된다). `mkcert`로 apps/web/.cert에 로컬 인증서를
// 발급해두면 자동으로 사용하고, 없으면 평범한 HTTP로 동작한다.
const httpsOptions =
  existsSync(keyPath) && existsSync(certPath)
    ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
    : undefined;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 빌드 플래그(Stage 4). `.env*`와 실행 환경변수를 Vite와 같은 규칙으로 읽는다.
  const figuresEnabled = loadEnv(mode, process.cwd(), "VITE_")["VITE_FIGURES_ENABLED"] === "true";
  return {
    // host: true로 0.0.0.0에 바인딩해야 iPad 등 LAN 기기가 접속할 수 있다(기본값은 localhost만 허용).
    server: { host: true, https: httpsOptions },
    // Stage 4 D-7: JSXGraph(도형 렌더러가 지연 로딩)를 이름이 고정된 별도 청크(`assets/jsxgraph-[hash].js`)로 분리한다.
    // Rolldown에서 `manualChunks`는 deprecated라 같은 역할의 `codeSplitting.groups`를 쓴다. 도형 기능 off 빌드에서는
    // 이 모듈을 import하는 코드가 없어 청크가 생기지 않는다.
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [{ name: "jsxgraph", test: /node_modules[\\/](?:\.pnpm[\\/])?jsxgraph/ }],
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        // D-7: JSXGraph 청크(약 0.7MB)는 precache하지 않고, 처음 그림을 볼 때 받아 런타임 캐시(CacheFirst)에 둔다 —
        // 그림을 보지 않는 사용자의 설치·업데이트 비용을 늘리지 않기 위해서다. 해시가 바뀌면 새 URL이라 오래된 항목은
        // 개수 상한으로 정리된다.
        workbox: {
          globIgnores: ["**/node_modules/**/*", "**/jsxgraph-*.js"],
          // 재작업 1(QA L-D): 도형 기능 off 빌드에는 JSXGraph 청크가 없으므로 런타임 라우트도 넣지 않는다(sw.js 동일 유지).
          runtimeCaching: figuresEnabled
            ? [
                {
                  urlPattern: /\/assets\/jsxgraph-[^/]+\.js$/,
                  handler: "CacheFirst",
                  options: { cacheName: "jsxgraph", expiration: { maxEntries: 4 } },
                },
              ]
            : [],
        },
        manifest: {
          name: "수풀잉",
          short_name: "수풀잉",
          display: "standalone",
          orientation: "landscape",
          start_url: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
  };
});
