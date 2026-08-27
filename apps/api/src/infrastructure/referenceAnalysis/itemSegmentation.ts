/**
 * 페이지 텍스트에서 문항 경계 후보를 찾는 순수 함수 모듈.
 *
 * 외부 AI API를 전혀 호출하지 않는다 — 정규식/토큰 기반 로컬 휴리스틱만 사용한다.
 * 입력(`extractPageText`가 만든 페이지 텍스트)은 이 모듈 안에서 오직 문항 "경계"만
 * 판단하는 데 쓰이고, 반환값에도 원문 스니펫을 담지 않는다(디버깅용 미리보기가 필요하면
 * 호출부에서 로컬 로그로만 다뤄야 한다).
 */

export interface SegmentationPageInput {
  pageNumber: number;
  /** `extractPageText`가 만든, 공백으로 정규화된 페이지 텍스트. */
  text: string;
}

export type ItemBoundaryPattern = "DOT_NUMBERED" | "STAR_RATED_NUMBERED";

export interface SegmentedItemCandidate {
  pageNumber: number;
  /** 페이지 내 등장 순서(1부터 시작). `local_item_key`의 `i##` 부분을 만드는 데 쓴다. */
  sequenceInPage: number;
  /** 문서에 표기된 번호 문자열(예: "1", "12"). */
  itemNumberLabel: string;
  matchedPattern: ItemBoundaryPattern;
  /** 0~1. 낮을수록 오탐 가능성이 높다는 뜻이다. */
  confidence: number;
  /** confidence < LOW_CONFIDENCE_THRESHOLD 이면 true. `review_status='NEEDS_REVIEW'`로 이어진다. */
  needsReview: boolean;
}

/** 이 값 미만이면 `review_status='NEEDS_REVIEW'`로 처리해야 한다. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** 객관식 보기(①②③...)는 문항 "경계"가 아니라 문항 내부 요소다 — 절대 새 문항 시작으로 잡지 않는다. */
const CIRCLED_DIGIT_PATTERN = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/u;

/** 번호 패턴 A: "1." / "1．" 처럼 숫자+마침표가 하나의 토큰인 경우. */
const DOT_NUMBERED_PATTERN = /^(\d{1,2})[.．]$/;

/** 순수 숫자 토큰(1~2자리). 별점 마커와 결합될 때만 문항 경계로 인정한다(패턴 B). */
const PLAIN_NUMBER_PATTERN = /^(\d{1,2})$/;

/** 번호 패턴 B에서 숫자 뒤에 오는 난이도 별점 마커(예: "★☆☆"). MathJK류 문서에서 관찰됨. */
const STAR_MARKER_PATTERN = /^[★☆]{2,}/u;

/** 별점 마커를 몇 토큰 이내에서 찾을지(숫자 토큰 바로 다음 1~2개 토큰까지 허용). */
const STAR_MARKER_LOOKAHEAD = 2;

/**
 * 페이지 텍스트 하나를 공백 기준으로 토큰화해 문항 경계 후보를 찾는다.
 * 같은 입력엔 항상 같은 결과를 돌려주는 순수 함수(파일시스템/네트워크 접근 없음).
 */
export function segmentPageIntoItems(input: SegmentationPageInput): SegmentedItemCandidate[] {
  const tokens = input.text.split(/\s+/).filter((token) => token.length > 0);
  const candidates: SegmentedItemCandidate[] = [];
  let sequenceInPage = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (CIRCLED_DIGIT_PATTERN.test(token)) continue;

    const dotMatch = DOT_NUMBERED_PATTERN.exec(token);
    if (dotMatch) {
      sequenceInPage += 1;
      candidates.push(
        buildCandidate(input.pageNumber, sequenceInPage, dotMatch[1]!, "DOT_NUMBERED", 0.75),
      );
      continue;
    }

    const plainMatch = PLAIN_NUMBER_PATTERN.exec(token);
    if (plainMatch) {
      const lookahead = tokens.slice(i + 1, i + 1 + STAR_MARKER_LOOKAHEAD);
      const hasStarMarker = lookahead.some((candidateToken) => STAR_MARKER_PATTERN.test(candidateToken));
      if (hasStarMarker) {
        sequenceInPage += 1;
        candidates.push(
          buildCandidate(input.pageNumber, sequenceInPage, plainMatch[1]!, "STAR_RATED_NUMBERED", 0.85),
        );
      }
    }
  }

  return candidates;
}

function buildCandidate(
  pageNumber: number,
  sequenceInPage: number,
  itemNumberLabel: string,
  matchedPattern: ItemBoundaryPattern,
  confidence: number,
): SegmentedItemCandidate {
  return {
    pageNumber,
    sequenceInPage,
    itemNumberLabel,
    matchedPattern,
    confidence,
    needsReview: confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

/** `reference_item_features.local_item_key` 형식: `{document_key}#p{페이지3자리}-i{순번2자리}`. */
export function buildLocalItemKey(documentKey: string, pageNumber: number, sequenceInPage: number): string {
  const page = String(pageNumber).padStart(3, "0");
  const sequence = String(sequenceInPage).padStart(2, "0");
  return `${documentKey}#p${page}-i${sequence}`;
}
