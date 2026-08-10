export interface SseEvent {
  event: string;
  data: string;
}

/**
 * `event: <name>\ndata: <payload>\n\n` 형태의 SSE 스트림을 파싱한다.
 * `EventSource`는 POST 요청과 커스텀 헤더(Authorization)를 지원하지 않으므로
 * `fetch` + `ReadableStream`으로 직접 구현한다.
 */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const rawBlock = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const parsed = parseBlock(rawBlock);
        if (parsed) {
          yield parsed;
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(rawBlock: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of rawBlock.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join("\n") };
}
