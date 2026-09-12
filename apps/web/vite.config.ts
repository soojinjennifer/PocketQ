import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
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
export default defineConfig({
  // host: true로 0.0.0.0에 바인딩해야 iPad 등 LAN 기기가 접속할 수 있다(기본값은 localhost만 허용).
  server: { host: true, https: httpsOptions },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
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
});
