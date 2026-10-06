import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { dispatchTrustedClick } from "../../../test/dispatchTrustedClick";
import { ActionMenu, type ActionMenuItem } from "./ActionMenu";

function Harness({
  items,
  dataAttributes,
  onOutsideClick,
}: {
  items: readonly ActionMenuItem[];
  dataAttributes?: Readonly<Record<`data-${string}`, string>>;
  onOutsideClick?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button
        ref={triggerRef}
        id="test-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls="test-menu"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        트리거
      </button>
      <button type="button" onClick={onOutsideClick} data-testid="outside">
        바깥
      </button>
      <ActionMenu
        id="test-menu"
        labelledBy="test-trigger"
        items={items}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        className="absolute top-full left-0"
        dataAttributes={dataAttributes}
      />
    </div>
  );
}

const makeItems = (onFirst = vi.fn(), onSecond = vi.fn()): ActionMenuItem[] => [
  { id: "first", label: "첫 항목", onSelect: onFirst },
  { id: "second", label: "둘째 항목", onSelect: onSecond },
];

describe("ActionMenu", () => {
  it("닫혀 있으면 아무것도 렌더링하지 않는다", () => {
    render(<Harness items={makeItems()} />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-menu-scrim")).not.toBeInTheDocument();
  });

  it("열리면 id가 붙은 menu와 항목을 순서대로 렌더링하고 첫 항목에 포커스한다", () => {
    render(<Harness items={makeItems()} />);

    fireEvent.click(screen.getByRole("button", { name: "트리거" }));

    const menu = screen.getByRole("menu");
    expect(menu).toHaveAttribute("id", "test-menu");
    expect(menu).toHaveAttribute("aria-labelledby", "test-trigger");
    expect(menu).toHaveAccessibleName("트리거");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["첫 항목", "둘째 항목"]);
    expect(items[0]).toHaveFocus();
  });

  it("항목 사이에만 aria-hidden 구분선(bg-separator 토큰)이 1개 있다", () => {
    render(<Harness items={makeItems()} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));

    const dividers = screen
      .getByRole("menu")
      .querySelectorAll("[aria-hidden='true']");
    expect(dividers).toHaveLength(1);
    expect(dividers[0]?.className).toContain("bg-separator");
  });

  it("기존 토큰만 재사용한 임시 디자인 클래스를 갖는다(새 색상 없음)", () => {
    render(<Harness items={makeItems()} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));

    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("bg-bg-elevated");
    expect(menu.className).toContain("rounded-[6px]");
    expect(menu.className).toContain(
      "drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]",
    );
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.className).toContain("px-[18px]");
      expect(item.className).toContain("py-[8px]");
      expect(item.className).toContain("text-[11px]");
      expect(item.className).toContain("leading-[13px]");
      expect(item.className).toContain("font-[590]");
      // Apple HIG 최소 터치 타깃 44pt, 눌림 표시는 기존 fill-tint-green 토큰.
      expect(item.className).toContain("min-h-[44px]");
      expect(item.className).toContain("active:bg-fill-tint-green");
    }
  });

  it("항목을 누르면 onSelect가 동기적으로 1회 호출되고 메뉴가 닫히며 트리거로 포커스가 돌아온다", () => {
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    render(<Harness items={makeItems(onFirst, onSecond)} />);
    const trigger = screen.getByRole("button", { name: "트리거" });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: "둘째 항목" }));

    expect(onSecond).toHaveBeenCalledTimes(1);
    expect(onFirst).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Escape를 누르면 아무 항목도 실행하지 않고 닫히며 트리거로 포커스가 돌아온다", () => {
    const onFirst = vi.fn();
    render(<Harness items={makeItems(onFirst)} />);
    const trigger = screen.getByRole("button", { name: "트리거" });
    fireEvent.click(trigger);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onFirst).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("바깥 요소를 탭하면 메뉴만 닫히고 그 요소의 click은 실행되지 않으며, 트리거로 포커스가 돌아온다", () => {
    const onOutsideClick = vi.fn();
    render(<Harness items={makeItems()} onOutsideClick={onOutsideClick} />);
    const trigger = screen.getByRole("button", { name: "트리거" });
    fireEvent.click(trigger);

    // pointerdown만으로는 닫지 않는다(즉시 언마운트하면 이어지는 click이 아래 요소로 새어 나간다).
    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    const notCanceled = dispatchTrustedClick(screen.getByTestId("outside"));

    expect(notCanceled).toBe(false);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onOutsideClick).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    // 메뉴가 닫힌 뒤에는 바깥 요소가 정상 동작한다.
    fireEvent.click(screen.getByTestId("outside"));
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it("투명 scrim(h-dvh)은 pointerdown 기본 동작을 막고(아래 캔버스에 획 시작 방지), 이어지는 click 시점에 닫힌다", () => {
    render(<Harness items={makeItems()} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));

    const scrim = screen.getByTestId("action-menu-scrim");
    expect(scrim).toHaveClass("fixed", "h-dvh", "-z-10");
    expect(scrim.className).not.toContain("inset-0");

    const pointerDownNotCanceled = fireEvent.pointerDown(scrim);
    expect(pointerDownNotCanceled).toBe(false);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.pointerUp(scrim);
    dispatchTrustedClick(scrim);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("사용자 입력이 아닌 바깥 click(isTrusted=false, 예: element.click())은 가로채지 않는다", () => {
    const onOutsideClick = vi.fn();
    render(<Harness items={makeItems()} onOutsideClick={onOutsideClick} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));

    screen.getByTestId("outside").click();

    expect(onOutsideClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("항목 onSelect가 동기로 일으킨 메뉴 밖 요소의 click(숨은 file input.click())은 취소되거나 전파가 막히지 않는다(P0 회귀)", () => {
    // HTMLInputElement.prototype.click을 모킹하지 않는다 — jsdom의 실제 click()이 만드는 이벤트를 관찰한다.
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    document.body.appendChild(fileInput);
    const seen: { defaultPrevented: boolean; isTrusted: boolean }[] = [];
    const onInputClick = vi.fn((event: Event) => {
      // 리스너 시점에는 아직 기본 동작 취소 여부를 알 수 없으므로 디스패치 후에도 다시 확인한다.
      seen.push({ defaultPrevented: event.defaultPrevented, isTrusted: event.isTrusted });
    });
    const onDocumentBubble = vi.fn();
    fileInput.addEventListener("click", onInputClick);
    document.addEventListener("click", onDocumentBubble);
    let dispatchResult: boolean | null = null;
    const items: ActionMenuItem[] = [
      {
        id: "library",
        label: "보관함",
        onSelect: () => {
          const event = new MouseEvent("click", { bubbles: true, cancelable: true });
          dispatchResult = fileInput.dispatchEvent(event);
          fileInput.click();
        },
      },
    ];
    render(<Harness items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));
    onDocumentBubble.mockClear();

    // 실제 사용자 탭(신뢰된 click)으로 항목을 고른다.
    dispatchTrustedClick(screen.getByRole("menuitem", { name: "보관함" }));

    expect(onInputClick).toHaveBeenCalledTimes(2);
    expect(seen.every((entry) => !entry.defaultPrevented)).toBe(true);
    expect(dispatchResult).toBe(true);
    // input에서 시작한 click 2건 + 메뉴 항목 click 1건이 모두 document까지 버블링됐다(전파 차단 없음).
    expect(
      onDocumentBubble.mock.calls.filter(([event]) => (event as Event).target === fileInput),
    ).toHaveLength(2);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    document.removeEventListener("click", onDocumentBubble);
    fileInput.remove();
  });

  it("항목 선택 중에는 신뢰된 click이라도 가로채지 않는다(isTrusted 판정과 별개의 2차 방어)", () => {
    const outsideTarget = document.createElement("button");
    document.body.appendChild(outsideTarget);
    const onOutside = vi.fn();
    outsideTarget.addEventListener("click", onOutside);
    let nestedNotCanceled: boolean | null = null;
    const items: ActionMenuItem[] = [
      {
        id: "x",
        label: "항목",
        onSelect: () => {
          nestedNotCanceled = dispatchTrustedClick(outsideTarget);
        },
      },
    ];
    render(<Harness items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));

    dispatchTrustedClick(screen.getByRole("menuitem", { name: "항목" }));

    expect(nestedNotCanceled).toBe(true);
    expect(onOutside).toHaveBeenCalledTimes(1);
    outsideTarget.remove();
  });

  it("passThroughRef 영역(트리거 제외)의 사용자 탭은 막지 않고 원래 대상까지 전달하며 메뉴만 닫는다", () => {
    const onSibling = vi.fn();
    function PassThroughHarness() {
      const [isOpen, setIsOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement>(null);
      const groupRef = useRef<HTMLDivElement>(null);
      return (
        <div ref={groupRef}>
          <button type="button" onClick={onSibling}>
            형제 세그먼트
          </button>
          <button ref={triggerRef} id="pt-trigger" type="button" onClick={() => setIsOpen((p) => !p)}>
            트리거
          </button>
          <ActionMenu
            id="pt-menu"
            labelledBy="pt-trigger"
            items={makeItems()}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            triggerRef={triggerRef}
            passThroughRef={groupRef}
          />
        </div>
      );
    }
    render(<PassThroughHarness />);
    const trigger = screen.getByRole("button", { name: "트리거" });
    fireEvent.click(trigger);

    const notCanceled = dispatchTrustedClick(screen.getByRole("button", { name: "형제 세그먼트" }));

    expect(notCanceled).toBe(true);
    expect(onSibling).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).not.toHaveFocus();

    // 트리거 자신의 탭은 예외 영역 안이어도 토글로만 동작한다(닫혔다가 다시 열리지 않는다).
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    dispatchTrustedClick(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("메뉴 내부나 트리거를 탭해도 바깥 탭으로 처리되지 않는다(트리거 클릭은 토글로 닫는다)", () => {
    render(<Harness items={makeItems()} />);
    const trigger = screen.getByRole("button", { name: "트리거" });
    fireEvent.click(trigger);

    fireEvent.pointerDown(screen.getByRole("menuitem", { name: "첫 항목" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Tab 등으로 포커스가 메뉴 밖으로 나가면 닫히고 트리거로 포커스를 되돌리지 않는다", () => {
    render(<Harness items={makeItems()} />);
    const trigger = screen.getByRole("button", { name: "트리거" });
    fireEvent.click(trigger);
    const outside = screen.getByTestId("outside");

    fireEvent.blur(screen.getAllByRole("menuitem")[0] as HTMLElement, { relatedTarget: outside });
    outside.focus();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
    expect(trigger).not.toHaveFocus();
  });

  it("포커스가 메뉴 안의 다른 항목이나 트리거로 이동하면 닫지 않는다", () => {
    render(<Harness items={makeItems()} />);
    const trigger = screen.getByRole("button", { name: "트리거" });
    fireEvent.click(trigger);
    const [first, second] = screen.getAllByRole("menuitem");

    fireEvent.blur(first as HTMLElement, { relatedTarget: second });
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.blur(second as HTMLElement, { relatedTarget: trigger });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("isOpen이 외부 요인으로 false가 되면 포커스를 트리거로 옮기지 않는다", () => {
    const triggerRef = { current: null as HTMLButtonElement | null };
    const { rerender } = render(
      <div>
        <button ref={triggerRef} id="t" type="button">
          트리거
        </button>
        <button type="button">다른 곳</button>
        <ActionMenu
          id="m"
          labelledBy="t"
          items={makeItems()}
          isOpen
          onClose={() => undefined}
          triggerRef={triggerRef}
        />
      </div>,
    );
    const other = screen.getByRole("button", { name: "다른 곳" });
    other.focus();

    rerender(
      <div>
        <button ref={triggerRef} id="t" type="button">
          트리거
        </button>
        <button type="button">다른 곳</button>
        <ActionMenu
          id="m"
          labelledBy="t"
          items={makeItems()}
          isOpen={false}
          onClose={() => undefined}
          triggerRef={triggerRef}
        />
      </div>,
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(other).toHaveFocus();
  });

  it("↑/↓ 키로 항목 사이를 순환 이동한다", () => {
    render(<Harness items={makeItems()} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));
    const [first, second] = screen.getAllByRole("menuitem");

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(second).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(second).toHaveFocus();
  });

  it("dataAttributes를 메뉴 루트에 붙인다(예: 캔버스 잉크 가림 표식)", () => {
    render(<Harness items={makeItems()} dataAttributes={{ "data-canvas-occluder": "" }} />);
    fireEvent.click(screen.getByRole("button", { name: "트리거" }));

    const root = screen.getByRole("menu").parentElement;
    expect(root).toHaveAttribute("data-canvas-occluder", "");
    expect(root).toHaveClass("absolute", "top-full", "left-0");
    expect(screen.getByTestId("action-menu-scrim")).not.toHaveAttribute("data-canvas-occluder");
  });
});
