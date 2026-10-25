/**
 * api 테스트 전역 setup(Stage 5 WU1 결함 수정, 장부 §8.3·§8.13).
 *
 * 원인: supertest(7.2.2)는 `app.listen(0)`(모든 인터페이스 `::`)으로 서버를 띄우고 `127.0.0.1:<port>`로 접속한다. macOS는 다른 프로세스가
 * `127.0.0.1:P`에만 묶어 둔 리스너(이 기기에서는 VS Code helper 3개, 49316·51229·51354)가 있어도 `::`의 포트로 P를 내줄 수 있고, 그러면
 * 테스트 요청이 그 외부 프로세스로 가서 엉뚱한 401·404를 받거나(chat.router.test "question 비면 400"이 404를 받은 사례) 응답이 오지 않아
 * 타임아웃이 난다. 실측: 동시 부하 실행에서 port 49316 요청이 외부 서버의 401을 받음(우리 서버 표시 헤더 없음), `listen(49316)`은 성공하고
 * 127.0.0.1 요청이 외부 서버의 401을 받으며, `listen(49316, "127.0.0.1")`은 EADDRINUSE.
 *
 * 수정: supertest가 서버를 직접 띄우는 경우에만 `127.0.0.1`에 묶는다(같은 주소면 커널이 충돌을 감지해 다른 포트를 준다). 호스트를 주면
 * listen이 비동기(주소 조회)라 supertest의 동기 `serverAddress`를 대신해 listening 뒤 URL을 정하고 `end`를 이어 부른다. 제품 코드 무변경.
 */
import type { Server } from "node:http";
import supertest from "supertest";

interface LoopbackTest {
  _server?: Server;
  url: string;
  _loopbackReady?: Promise<void>;
  _loopbackPath?: string;
}
type EndCallback = (error: unknown, response?: unknown) => void;
interface TestPrototype {
  serverAddress: (this: LoopbackTest, app: Server, path: string) => string;
  end: (this: LoopbackTest, fn?: EndCallback) => unknown;
}

const testPrototype = (supertest as unknown as { Test: { prototype: TestPrototype } }).Test.prototype;
const originalServerAddress = testPrototype.serverAddress;
const originalEnd = testPrototype.end;

testPrototype.serverAddress = function serverAddress(this: LoopbackTest, app: Server, path: string): string {
  if (app.address()) return originalServerAddress.call(this, app, path);
  const server = app.listen(0, "127.0.0.1");
  this._server = server;
  this._loopbackPath = path;
  this._loopbackReady = new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });
  return `http://127.0.0.1:0${path}`;
};

testPrototype.end = function end(this: LoopbackTest, fn?: EndCallback): unknown {
  const ready = this._loopbackReady;
  if (!ready) return originalEnd.call(this, fn);
  this._loopbackReady = undefined;
  ready.then(
    () => {
      const address = this._server?.address();
      const port = address && typeof address === "object" ? address.port : 0;
      this.url = `http://127.0.0.1:${port}${this._loopbackPath ?? ""}`;
      originalEnd.call(this, fn);
    },
    (error: unknown) => fn?.(error),
  );
  return this;
};
