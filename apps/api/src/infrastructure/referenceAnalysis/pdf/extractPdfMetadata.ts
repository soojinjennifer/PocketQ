import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * 로컬 PDF 파일 메타데이터(sha256 해시 + 페이지 수)만 추출한다.
 *
 * 중요(저작권 안전 정책): 이 함수는 PDF 바이트를 읽어 로컬에서만 처리하며, 어떤 외부
 * 네트워크 요청도 하지 않는다(OpenAI/Anthropic 등 외부 AI API에 절대 전송하지 않는다).
 * `pdfjs-dist`는 페이지 구조 파싱에만 쓰이고, 페이지 렌더링(canvas)이나 이미지 생성은
 * 하지 않는다(경로 B: 렌더링 자체가 불필요).
 */
export interface PdfMetadata {
  fileHash: string;
  pageCount: number;
  parserVersion: string;
}

/** `pdfjs-dist`의 런타임 버전 문자열. package.json 버전과 동기화된다. */
export const PDFJS_PARSER_VERSION = "pdfjs-dist@6.2.108";

export async function extractPdfMetadata(filePath: string): Promise<PdfMetadata> {
  const bytes = readFileSync(filePath);
  const fileHash = createHash("sha256").update(bytes).digest("hex");

  // Node.js에는 Worker 생성자가 없어 pdfjs-dist가 자동으로 메인 스레드("fake worker")로
  // 동작한다. useSystemFonts만 명시(Node 기본값 false를 켜서 폰트 미임베딩 시에도 파싱이
  // 끊기지 않게 한다). 네트워크/canvas 관련 옵션은 전혀 쓰지 않는다(경로 B: 렌더링 불필요).
  const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const document = await loadingTask.promise;
  try {
    return { fileHash, pageCount: document.numPages, parserVersion: PDFJS_PARSER_VERSION };
  } finally {
    // PDFDocumentProxy가 아니라 loadingTask 쪽에 destroy()가 있다(pdfjs-dist API).
    await loadingTask.destroy();
  }
}
