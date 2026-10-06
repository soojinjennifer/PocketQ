import { useEffect, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from "react";

export interface ActionMenuItem {
  id: string;
  label: string;
  /** 항목 클릭 핸들러 안에서 **동기적으로** 호출된다(예: iOS 파일 선택 창은 사용자 제스처 안에서 열어야 한다). */
  onSelect: () => void;
}

interface ActionMenuProps {
  /** 트리거 버튼의 `aria-controls`와 연결되는 메뉴 id. */
  id: string;
  /** 트리거 버튼의 id — `role="menu"`의 `aria-labelledby`로 연결한다. */
  labelledBy: string;
  items: readonly ActionMenuItem[];
  isOpen: boolean;
  /** Escape, 바깥 탭, 포커스 이탈, 항목 선택 직후에 호출된다. */
  onClose: () => void;
  /** 메뉴를 여는 버튼 — 바깥 탭 판정에서 제외하고(트리거 자신이 토글한다), Escape/항목 선택/바깥 탭으로
   *  닫히면 이 버튼으로 포커스를 돌려준다. */
  triggerRef: RefObject<HTMLElement | null>;
  /** 바깥 탭 차단에서 제외할 영역(예: 트리거가 속한 세그먼트 토글 전체). 이 영역 안의 click은 가로채지
   *  않고 원래 대상까지 전달되며, 트리거가 아닌 곳이면 메뉴만 닫는다(포커스 복귀 없음) — 예를 들어 메뉴가
   *  열린 채 같은 토글의 다른 세그먼트를 탭하면 메뉴가 닫히고 그 세그먼트가 바로 선택된다. 포커스
   *  이동 여부가 플랫폼마다 달라(iPadOS는 탭해도 버튼에 포커스가 가지 않는다) 동작을 click 기준으로 맞춘다. */
  passThroughRef?: RefObject<HTMLElement | null>;
  /** 메뉴 루트 위치 지정용 클래스(예: `absolute top-full right-0`). 시각 스타일은 이 컴포넌트가 소유한다. */
  className?: string;
  /** 메뉴 루트에 붙일 `data-*` 속성(예: 필기 캔버스 잉크 가림 표식 `CANVAS_OCCLUDER_PROPS`). */
  dataAttributes?: Readonly<Record<`data-${string}`, string>>;
}

/**
 * 범용 액션 메뉴(드롭다운) — 트리거 아래에 항목 목록을 띄운다. 도메인 지식을 갖지 않는다.
 *
 * **Figma 대응 없음 — 임시 디자인(Figma 확정 대기).** 새 색상/임의 픽셀값 없이 기존 토큰과
 * 기존 실측값만 재사용했다(`docs/COMPONENT_MAP.md` 참고):
 * - 표면: `bg-bg-elevated` + `rounded-[6px]`(ProblemCard/InputModeToggle과 같은 반경) +
 *   `Elevation/Card` 그림자(`docs/DESIGN_SYSTEM.md` §4, ResultCard/ChatBubble과 같은 리터럴).
 * - 항목: InputModeToggle 세그먼트와 같은 라벨 글꼴(11px/13px/590)과 패딩(`px-[18px] py-[8px]`),
 *   터치 타깃은 Apple HIG 최소 44pt(`min-h-[44px]`), 눌림/키보드 포커스 표시는 기존
 *   `fill-tint-green` 토큰, 항목 사이 구분선은 기존 `bg-separator` 토큰(InputGroup과 같은 패턴).
 *
 * 동작:
 * - 열리면 첫 항목에 포커스, ↑/↓로 항목 이동.
 * - Escape → 닫고 트리거로 포커스 복귀. 항목 선택 → `onSelect` 동기 호출 후 닫고 트리거로 복귀.
 * - 바깥 탭(사용자 입력 click만, `isTrusted`) → 닫고 트리거로 복귀. **그 탭은 아래 요소로 전달되지 않는다**: 투명 scrim이 포인터를
 *   받아(`pointerdown` preventDefault — 캔버스에 획이 시작되지 않는다) 메뉴를 바로 언마운트하지 않고
 *   두며, 이어지는 `click`을 document capture 단계에서 가로채 전파를 막은 뒤 닫는다. scrim 밖(다른
 *   stacking context)의 요소를 눌러도 그 click은 실행되지 않고 메뉴만 닫힌다.
 * - `passThroughRef` 영역 안의 탭은 차단하지 않고 메뉴만 닫는다(트리거 제외).
 * - Tab 등으로 포커스가 메뉴 밖으로 나가면 닫는다(포커스 복귀 없음). 단 트리거로 이동하는 경우는
 *   트리거 자신의 토글과 충돌하지 않도록 닫지 않는다.
 * - `isOpen`이 외부 요인(예: 트리거 비활성화)으로 false가 되면 포커스를 건드리지 않는다.
 *
 * scrim은 `-z-10`이라 가장 가까운 stacking context 안에서 트리거/메뉴보다 아래, 그 context 바깥의
 * 아래 레이어보다는 위에 놓인다 — 이 컴포넌트는 z-index가 지정된 positioned 요소 안에 렌더링해야 한다.
 */
export function ActionMenu({
  id,
  labelledBy,
  items,
  isOpen,
  onClose,
  triggerRef,
  passThroughRef,
  className,
  dataAttributes,
}: ActionMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // 항목 선택 처리(onSelect) 중에는 캡처 리스너를 끈다 — onSelect가 동기로 일으키는 click(예: 숨은
  // file input의 `input.click()`)을 바깥 탭으로 오인해 막으면 파일 선택 창이 열리지 않는다(P0 회귀).
  const isSelectingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (isOpen) {
      itemRefs.current[0]?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeAndReturnFocus = () => {
      onCloseRef.current();
      triggerRef.current?.focus();
    };
    // 바깥 탭의 click을 capture 단계에서 가로챈다 — React 루트보다 먼저 실행되므로 아래 요소의
    // onClick(예: ActionBar "문제 인식하기")이 실행되지 않는다.
    // 사용자 입력이 아닌 click(`element.click()` 등, isTrusted=false)은 건드리지 않는다 — 항목 onSelect가
    // 동기로 여는 파일 선택 창(`input.click()`)이 여기서 취소되지 않게 하는 1차 방어. 2차 방어는
    // `isSelectingRef`.
    const handleClickCapture = (event: MouseEvent) => {
      if (!event.isTrusted || isSelectingRef.current) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      if (passThroughRef?.current?.contains(target)) {
        onCloseRef.current();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeAndReturnFocus();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndReturnFocus();
      }
    };
    document.addEventListener("click", handleClickCapture, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickCapture, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, triggerRef, passThroughRef]);

  if (!isOpen) {
    return null;
  }

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const buttons = itemRefs.current.filter((button): button is HTMLButtonElement => button !== null);
    if (buttons.length === 0) {
      return;
    }
    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + step + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  // Tab 등으로 포커스가 메뉴 밖으로 나가면 닫는다(포커스 복귀 없음).
  const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (rootRef.current?.contains(next) || triggerRef.current?.contains(next))) {
      return;
    }
    if (next === null) {
      // 포커스 대상이 없는 이탈(예: 창 전환)은 무시한다 — 바깥 탭은 click 가로채기가 처리한다.
      return;
    }
    onCloseRef.current();
  };

  return (
    <>
      {/* 투명 scrim — 메뉴 바깥 탭을 흡수한다. pointerdown을 막아 아래 캔버스에 획이 시작되지 않게
      하고, 닫기는 이어지는 click 시점에 한다(위 capture 리스너). onClick은 iOS Safari가 비대화형
      요소에도 click을 발생시키게 하는 용도를 겸한다. 화면 전체 고정 레이어라 `inset-0`/`vh` 대신
      `h-dvh`를 쓴다(frontend.md §3-6). */}
      <div
        aria-hidden="true"
        data-testid="action-menu-scrim"
        className="fixed inset-x-0 top-0 -z-10 h-dvh"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          onCloseRef.current();
          triggerRef.current?.focus();
        }}
      />
      <div ref={rootRef} {...dataAttributes} className={className}>
        <div
          id={id}
          role="menu"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          onBlur={handleMenuBlur}
          className="bg-bg-elevated flex flex-col overflow-hidden rounded-[6px] outline-none drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]"
        >
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-col">
              {index > 0 ? <div aria-hidden="true" className="bg-separator h-px" /> : null}
              <button
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  isSelectingRef.current = true;
                  try {
                    item.onSelect();
                  } finally {
                    isSelectingRef.current = false;
                  }
                  onCloseRef.current();
                  triggerRef.current?.focus();
                }}
                className="text-label-secondary focus-visible:bg-fill-tint-green active:bg-fill-tint-green flex min-h-[44px] items-center px-[18px] py-[8px] text-left text-[11px] leading-[13px] font-[590] whitespace-nowrap outline-none"
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
