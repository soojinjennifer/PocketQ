import { existsSync, readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

const certDir = fileURLToPath(new URL("../.cert", import.meta.url));
const keyPath = `${certDir}/key.pem`;
const certPath = `${certDir}/cert.pem`;
// apps/web/vite.config.ts와 동일한 이유: 프론트가 iPad 카메라 테스트를 위해 mkcert HTTPS로 뜬
// 상태에서 이 API를 http로 호출하면 브라우저가 mixed content로 막는다. 인증서가 있으면 HTTPS로,
// 없으면 평범한 HTTP로 동작한다.
const httpsOptions =
  existsSync(keyPath) && existsSync(certPath)
    ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
    : undefined;

const server = httpsOptions ? createHttpsServer(httpsOptions, app) : createHttpServer(app);

server.listen(env.port, () => {
  console.log(`PocketQ API listening on port ${env.port} (${httpsOptions ? "https" : "http"})`);
});
