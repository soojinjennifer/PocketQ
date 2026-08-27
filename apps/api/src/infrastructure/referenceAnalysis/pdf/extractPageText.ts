import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * 페이지별 텍스트 추출 결과. 이 값은 DB에는 절대 저장하지 않는다 — 아이템 경계
 * 추정(`itemSegmentation.ts`)과 개발자의 로컬 수동 큐레이션(피처 데이터셋 작성) 용도로만
 * 쓰고, CLI에서 로컬 캐시 파일(`.extraction-cache/`, gitignore 대상)에만 남긴다.
 */
export interface PageText {
  pageNumber: number;
  text: string;
}

/**
 * 로컬 PDF 파일에서 페이지별 텍스트를 추출한다.
 *
 * 중요(저작권 안전 정책): 이 함수는 어떤 외부 네트워크 요청도 하지 않는다(순수 로컬
 * `pdfjs-dist` 파싱). 반환값(원문에 가까운 텍스트)을 OpenAI/Anthropic 등 외부 AI API로
 * 전송하는 코드를 이 파이프라인의 어디에도 연결하지 않는다 — 호출부(CLI)에서만 로컬
 * 캐시 파일 저장 + 개발자의 직접 읽기(수동 큐레이션) 용도로 사용해야 한다.
 */
export async function extractPageText(
  filePath: string,
  options?: { fromPage?: number; toPage?: number },
): Promise<PageText[]> {
  const bytes = readFileSync(filePath);
  // Node.js에는 Worker 생성자가 없어 pdfjs-dist가 자동으로 메인 스레드("fake worker")로
  // 동작한다. useSystemFonts만 명시(Node 기본값 false를 켜서 폰트 미임베딩 시에도 파싱이
  // 끊기지 않게 한다).
  const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const document = await loadingTask.promise;

  try {
    const fromPage = options?.fromPage ?? 1;
    const toPage = options?.toPage ?? document.numPages;
    const pages: PageText[] = [];

    for (let pageNumber = fromPage; pageNumber <= toPage; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim();
      pages.push({ pageNumber, text });
    }

    return pages;
  } finally {
    // PDFDocumentProxy가 아니라 loadingTask 쪽에 destroy()가 있다(pdfjs-dist API).
    await loadingTask.destroy();
  }
}
