/**
 * iPad 필기 입력 유실 P0 장애 진단용 런타임 토글 디버그 로거.
 *
 * 중요: `import.meta.env.DEV`로 빌드타임에 걸러내지 않는다 — 이 버그는 프로덕션 배포본에서만
 * 재현되므로, 코드는 항상 번들에 포함하되 기본은 꺼져 있고(no-op) 런타임에만 켤 수 있어야
 * 한다(오너 확정). 활성화 방법:
 * 1. URL에 `?pointerDebug=1` 쿼리 파라미터를 붙여 페이지를 한 번 로드한다(이후 새로고침에도
 *    유지되도록 `localStorage`에 저장한다 — 쿼리 파라미터를 계속 들고 다닐 필요 없음).
 * 2. 또는 콘솔에서 직접 `localStorage.setItem("pq:pointerDebug", "1")` 후 새로고침.
 *
 * 활성화된 상태에서는 `window.__pqPointerDebug.dump()`/`.export()`로 원격 디버깅 세션에서 바로
 * 조회할 수 있다. 문제 이미지, 사용자 정보, 인증 토큰은 절대 기록하지 않는다 — 포인터 좌표/타입/
 * 압력 등 순수 입력 이벤트 메타데이터와 캔버스 크기/스트로크 개수만 남긴다.
 */

const STORAGE_KEY = "pq:pointerDebug";
const RING_BUFFER_SIZE = 3000;

export type PointerDebugEventType =
  | "pointerdown"
  | "pointermove"
  | "pointerup"
  | "pointercancel"
  | "pointerleave"
  | "lostpointercapture"
  | "resize"
  | "mount"
  | "unmount"
  | "longtask-fallback"
  | "offscreen-cache-rebuild"
  | "render";

export interface PointerDebugEntry {
  timestamp: number;
  eventType: PointerDebugEventType;
  pointerId?: number;
  pointerType?: string;
  isPrimary?: boolean;
  buttons?: number;
  pressure?: number;
  clientX?: number;
  clientY?: number;
  activePointerIdBefore: number | null;
  activePointerIdAfter: number | null;
  drawing: boolean;
  coalescedCount: number | null;
  hasCapture: boolean | null;
  canvasWidth?: number;
  canvasHeight?: number;
  strokeCount?: number;
  /** pointerdown부터 그 pointerId의 첫 실제 draw(pointermove 좌표 반영)까지 걸린 시간(ms). */
  firstDrawLatencyMs?: number;
  /** pointerId 재사용과 무관하게 "몇 번째 획인지"를 구분하는 단조증가 세션 식별자
   *  (iPad 두 번째 획 유실 P0 4차 재조사). */
  sessionId?: number;
  /** `setPointerCapture` 시도 결과. `"skipped"`는 진단 플래그로 명시적 캡처 자체를 껐을 때. */
  captureAttemptResult?: "success" | "failed" | "skipped";
  /** 캡처 시도가 실패했을 때 실제 `DOMException.name`. */
  captureErrorName?: string;
  /** 캡처 시도가 실패했을 때 실제 `DOMException.message`. */
  captureErrorMessage?: string;
  /** `setPointerCapture` 시도 직후 실제로 캡처된 상태인지(암묵적 캡처 포함,
   *  `hasPointerCapture`로 확인한 값) — 명시적 호출이 실패했어도 브라우저가 암묵적으로
   *  캡처했을 가능성을 이 필드로 구분한다. */
  hasCaptureAfterAttempt?: boolean | null;
  /** `pointerdown` 시점에 첫 점이 실제로 `activeStrokeRef`에 push되어 그려졌는지(항상 true여야
   *  정상 — false로 로깅되면 회귀 신호). */
  firstPointDrawn?: boolean;
  /** 이 이벤트가 canvas의 React 합성 이벤트로 도착했는지, document fallback 리스너로
   *  도착했는지. */
  eventSource?: "canvas" | "document";
  /** `pointerup`/`pointercancel`/`lostpointercapture`(또는 document fallback 종료) 시점에
   *  `onCommitStroke`가 실제로 호출됐는지. */
  strokeConfirmed?: boolean;
  /** `"resize"` 이벤트 전용 — `ResizeObserver` 발화 시점에 캔버스 backing store 크기가 실제로
   *  바뀌었는지(`canvas.width`/`canvas.height` 재할당 여부). `false`면 스퓨리어스(크기 변화 없는)
   *  발화였다는 뜻이다(iPad 두 번째 획 유실 P0 재조사, canvas.width/height 무조건 재할당 버그 수정). */
  sizeChanged?: boolean;
  /** 오프스크린 캐시 재계산 시점의 커밋된 stroke 개수와 총 좌표 개수(데이터가 실제로 온전한지
   *  확인용, iPad 렌더링 파이프라인 P0 재조사). */
  offscreenStrokeCount?: number;
  offscreenTotalPointCount?: number;
  /** `render()` 호출 시점에 오프스크린 캐시 자체가 존재하는지(`offscreenCanvasRef.current !== null`). */
  offscreenCacheExists?: boolean;
}

function readEnabledFromStorage(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistEnabledFlagFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pointerDebug") === "1") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
  } catch {
    // localStorage/URL 접근이 막힌 환경(프라이빗 모드 등)에서는 조용히 무시한다.
  }
}

// 모듈 로드 시 1회만 URL 쿼리 파라미터를 확인해 localStorage에 반영한다.
if (typeof window !== "undefined") {
  persistEnabledFlagFromUrl();
}

const isEnabled = typeof window !== "undefined" && readEnabledFromStorage();

// 고정 크기 순환 배열(ring buffer). `entries.length`는 활성화 시 최대 RING_BUFFER_SIZE로 고정되고,
// 가장 오래된 항목부터 덮어쓴다.
const entries: PointerDebugEntry[] = [];
let writeIndex = 0;
let hasWrapped = false;

/**
 * 디버그 로그 1건을 기록한다. 비활성 상태(`localStorage`에 켜져 있지 않음)면 즉시 no-op이라
 * 오버헤드가 사실상 없다 — 핫패스(`pointermove` 등)에서 매번 호출해도 안전하다.
 */
export function logPointerEvent(entry: PointerDebugEntry): void {
  if (!isEnabled) {
    return;
  }
  if (entries.length < RING_BUFFER_SIZE) {
    entries.push(entry);
  } else {
    entries[writeIndex] = entry;
    hasWrapped = true;
  }
  writeIndex = (writeIndex + 1) % RING_BUFFER_SIZE;
}

/** 현재까지 기록된 로그 스냅샷을 시간순으로 반환한다(비활성 상태면 항상 빈 배열). */
export function getPointerDebugDump(): PointerDebugEntry[] {
  if (!isEnabled) {
    return [];
  }
  if (!hasWrapped) {
    return [...entries];
  }
  return [...entries.slice(writeIndex), ...entries.slice(0, writeIndex)];
}

/** 덤프를 클립보드로 복사한다(실패하면 콘솔 출력으로 폴백한다). */
export function exportPointerDebugDump(): void {
  const dump = getPointerDebugDump();
  const json = JSON.stringify(dump);
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clipboard?.writeText) {
    clipboard.writeText(json).catch(() => {
      console.log(json);
    });
    return;
  }
  console.log(json);
}

declare global {
  interface Window {
    __pqPointerDebug?: {
      dump: typeof getPointerDebugDump;
      export: typeof exportPointerDebugDump;
    };
  }
}

if (isEnabled && typeof window !== "undefined") {
  window.__pqPointerDebug = {
    dump: getPointerDebugDump,
    export: exportPointerDebugDump,
  };
}

/** 테스트 전용: 활성화 여부를 다시 계산하지 않고도 현재 켜져 있는지 확인할 수 있게 노출한다. */
export function isPointerDebugEnabled(): boolean {
  return isEnabled;
}
