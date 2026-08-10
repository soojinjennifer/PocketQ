import { describe, expect, it } from "vitest";
import { parseSseStream } from "./parseSse";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
}

async function collect<T>(iterable: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
  }
  return results;
}

describe("parseSseStream", () => {
  it("event/data 블록 하나를 정확히 파싱한다", async () => {
    const stream = streamFromChunks(['event: chunk\ndata: {"delta":"안녕"}\n\n']);

    const events = await collect(parseSseStream(stream));

    expect(events).toEqual([{ event: "chunk", data: '{"delta":"안녕"}' }]);
  });

  it("청크가 중간에 잘려 도착해도 완전한 블록 단위로 조립해서 파싱한다", async () => {
    const stream = streamFromChunks(['event: ch', 'unk\ndata: {"delta":"A"}', "\n\n", 'event: done\ndata: {"ok":true}\n\n']);

    const events = await collect(parseSseStream(stream));

    expect(events).toEqual([
      { event: "chunk", data: '{"delta":"A"}' },
      { event: "done", data: '{"ok":true}' },
    ]);
  });

  it("여러 이벤트를 순서대로 모두 파싱한다", async () => {
    const stream = streamFromChunks([
      'event: chunk\ndata: {"delta":"1"}\n\nevent: chunk\ndata: {"delta":"2"}\n\nevent: done\ndata: {"ok":true}\n\n',
    ]);

    const events = await collect(parseSseStream(stream));

    expect(events).toHaveLength(3);
    expect(events[2]).toEqual({ event: "done", data: '{"ok":true}' });
  });

  it("data가 없는 블록은 무시한다", async () => {
    const stream = streamFromChunks([": comment only\n\nevent: chunk\ndata: {"]);
    // 마지막 불완전 블록은 스트림 종료까지 버퍼에 남아있다가 남은 데이터가 없으면 파싱되지 않는다.

    const events = await collect(parseSseStream(stream));

    expect(events).toEqual([]);
  });
});
