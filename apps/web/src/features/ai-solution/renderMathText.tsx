import type { ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * `ResultCard`/`AnswerBox` 전용 최소 KaTeX 렌더 유틸. 별도의 Markdown 렌더링 파이프라인
 * (`react-markdown`/`remark-math`/`rehype-katex` 등)은 도입하지 않고, 텍스트 안에서 수식
 * 구분자로 감싼 구간만 찾아 KaTeX로 치환한다. 실제 백엔드 응답은 `\( ... \)`(인라인)/
 * `\[ ... \]`(블록) 구분자를 쓰는 것을 라이브 테스트로 확인했고, `$...$`/`$$...$$`는
 * 방어적으로만 지원한다. 다른 화면/공통 텍스트 컴포넌트에서는 사용하지 않는다(전역 적용 금지).
 */

interface MathSegment {
  type: "text" | "math";
  content: string;
  displayMode: boolean;
}

// 블록(`\[...\]`, `$$...$$`)을 인라인(`\(...\)`, `$...$`)보다 먼저 매치해야 `$$`가 `$`로
// 잘못 쪼개지지 않는다. 순서상 이 정규식의 그룹 우선순위가 그 역할을 한다.
const MATH_PATTERN = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;

function splitMathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let lastIndex = 0;
  const pattern = new RegExp(MATH_PATTERN);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index), displayMode: false });
    }

    const [full, blockBracket, inlineParen, blockDollar, inlineDollar] = match;
    if (blockBracket !== undefined) {
      segments.push({ type: "math", content: blockBracket, displayMode: true });
    } else if (inlineParen !== undefined) {
      segments.push({ type: "math", content: inlineParen, displayMode: false });
    } else if (blockDollar !== undefined) {
      segments.push({ type: "math", content: blockDollar, displayMode: true });
    } else if (inlineDollar !== undefined) {
      segments.push({ type: "math", content: inlineDollar, displayMode: false });
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex), displayMode: false });
  }

  return segments;
}

/** 원본 구분자를 그대로 되살려서 렌더링 실패 시 폴백 텍스트로 보여준다. */
function toRawMathText(content: string, displayMode: boolean): string {
  return displayMode ? `\\[${content}\\]` : `\\(${content}\\)`;
}

/**
 * `text` 안의 `\(...\)`/`\[...\]`(및 `$...$`/`$$...$$`) 구간만 KaTeX로 렌더링하고 나머지는
 * 그대로 출력한다. 개별 수식 변환이 실패해도 예외를 던지지 않고 원본 텍스트를 그대로 보여준다.
 */
export function renderMathText(text: string): ReactNode {
  const segments = splitMathSegments(text);

  return segments.map((segment, index) => {
    if (segment.type === "text") {
      return <span key={index}>{segment.content}</span>;
    }

    try {
      const html = katex.renderToString(segment.content, {
        displayMode: segment.displayMode,
        throwOnError: true,
      });
      // KaTeX가 생성한 HTML만 주입한다(사용자 입력을 직접 주입하지 않음).
      return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <span key={index}>{toRawMathText(segment.content, segment.displayMode)}</span>;
    }
  });
}
