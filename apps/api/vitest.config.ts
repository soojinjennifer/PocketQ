import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    exclude: ["**/node_modules/**", "**/dist/**"],
    // supertest 서버를 127.0.0.1에 묶는다(외부 127.0.0.1 리스너와의 포트 충돌로 엉뚱한 응답을 받던 결함 수정, WU1).
    setupFiles: ["./src/test-support/loopbackListen.ts"],
  },
});
