import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("icon='check'일 때 체크 아이콘 텍스트와 제목/부제를 표시한다", () => {
    render(
      <Modal
        icon="check"
        title="로그인 되었습니다"
        description="다시 오셨네요. 오늘도 풀어볼까요?"
        actionLabel="계속하기"
        onAction={() => {}}
      />,
    );

    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("로그인 되었습니다")).toBeInTheDocument();
    expect(screen.getByText("다시 오셨네요. 오늘도 풀어볼까요?")).toBeInTheDocument();
  });

  it("icon='email'일 때 이메일 아이콘 이미지를 표시한다", () => {
    const { container } = render(
      <Modal
        icon="email"
        title="이메일 인증 대기중"
        description="이메일을 확인해 주세요"
        actionLabel="계속하기"
        onAction={() => {}}
      />,
    );

    expect(screen.queryByText("✓")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeInTheDocument();
  });

  it("icon='error'일 때 느낌표 글리프를 표시한다", () => {
    const { container } = render(
      <Modal
        icon="error"
        title="오류가 발생했습니다"
        description="잠시 후 다시 시도해 주세요"
        actionLabel="확인"
        onAction={() => {}}
      />,
    );

    expect(screen.getByText("!")).toBeInTheDocument();
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("icon='check'/'email'일 때 role='dialog'를 사용하고 aria-live는 설정하지 않는다", () => {
    render(
      <Modal
        icon="check"
        title="로그인 되었습니다"
        description="다시 오셨네요. 오늘도 풀어볼까요?"
        actionLabel="계속하기"
        onAction={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).not.toHaveAttribute("aria-live");
  });

  it("icon='error'일 때 role='alertdialog'와 aria-live='assertive'를 사용한다", () => {
    render(
      <Modal
        icon="error"
        title="오류가 발생했습니다"
        description="잠시 후 다시 시도해 주세요"
        actionLabel="확인"
        onAction={() => {}}
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-live", "assertive");
  });

  it("마운트 시 액션 버튼으로 포커스를 이동한다", () => {
    render(
      <Modal
        icon="check"
        title="제목"
        description="설명"
        actionLabel="계속하기"
        onAction={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "계속하기" })).toHaveFocus();
  });

  it("하단 버튼 클릭 시 onAction을 호출한다", () => {
    const onAction = vi.fn();
    render(
      <Modal
        icon="check"
        title="제목"
        description="설명"
        actionLabel="계속하기"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("cancelLabel/onCancel을 전달하면 취소 버튼이 렌더링되고 클릭 시 onCancel을 호출한다", () => {
    const onAction = vi.fn();
    const onCancel = vi.fn();
    render(
      <Modal
        icon="email"
        title="이 기기에서 로그인한 기록이 없어요"
        description="이메일을 다시 확인하거나 회원가입을 진행해 주세요"
        actionLabel="회원가입하기"
        onAction={onAction}
        cancelLabel="취소"
        onCancel={onCancel}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: "취소" });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("cancelLabel을 전달하지 않으면 취소 버튼이 렌더링되지 않는다(하위 호환)", () => {
    render(
      <Modal
        icon="check"
        title="제목"
        description="설명"
        actionLabel="계속하기"
        onAction={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  describe("접근 가능한 이름·설명(aria-labelledby / aria-describedby)", () => {
    it("role='dialog'의 접근 가능한 이름은 제목, 설명은 description이다", () => {
      render(
        <Modal icon="check" title="로그인 되었습니다" description="다시 오셨네요." actionLabel="계속하기" onAction={() => {}} />,
      );

      const dialog = screen.getByRole("dialog", { name: "로그인 되었습니다" });
      expect(dialog).toHaveAccessibleDescription("다시 오셨네요.");
      const title = screen.getByRole("heading", { name: "로그인 되었습니다" });
      expect(dialog).toHaveAttribute("aria-labelledby", title.id);
    });

    it("role='alertdialog'도 제목을 이름으로, description을 설명으로 갖는다", () => {
      render(
        <Modal icon="error" title="오류가 발생했습니다" description="잠시 후 다시 시도해 주세요" actionLabel="확인" onAction={() => {}} />,
      );

      const dialog = screen.getByRole("alertdialog", { name: "오류가 발생했습니다" });
      expect(dialog).toHaveAccessibleDescription("잠시 후 다시 시도해 주세요");
    });

    it("content 슬롯을 쓰면 aria-describedby를 두지 않는다(이름은 그대로 제목)", () => {
      render(
        <Modal title="이 문제가 맞나요?" content={<div>미리보기 카드</div>} description="무시됨" actionLabel="확인" onAction={() => {}} />,
      );

      const dialog = screen.getByRole("dialog", { name: "이 문제가 맞나요?" });
      expect(dialog).not.toHaveAttribute("aria-describedby");
      expect(dialog).toHaveAccessibleDescription("");
    });

    it("description이 없거나 공백뿐이면 aria-describedby를 두지 않는다", () => {
      const { unmount } = render(<Modal icon="check" title="제목만" actionLabel="확인" onAction={() => {}} />);
      expect(screen.getByRole("dialog", { name: "제목만" })).not.toHaveAttribute("aria-describedby");
      unmount();

      render(<Modal icon="check" title="공백 설명" description="   " actionLabel="확인" onAction={() => {}} />);
      expect(screen.getByRole("dialog", { name: "공백 설명" })).not.toHaveAttribute("aria-describedby");
    });

    it.each([
      ["false", false],
      ["빈 문자열", ""],
      ["0", 0],
    ] as const)("content=%s(falsy지만 nullish 아님)면 p가 없으므로 aria-describedby도 없다", (_label, content) => {
      const { container } = render(
        <Modal icon="check" title="falsy content" description="보이지 않는 설명" content={content} actionLabel="확인" onAction={() => {}} />,
      );

      const dialog = screen.getByRole("dialog", { name: "falsy content" });
      expect(dialog).not.toHaveAttribute("aria-describedby");
      expect(container.querySelector("p")).toBeNull();
      expect(dialog).toHaveAccessibleDescription("");
    });

    it("aria-describedby가 있으면 항상 문서 안의 실제 요소를 가리킨다", () => {
      const cases = [
        { content: undefined, description: "설명" },
        { content: null, description: "설명" },
        { content: false, description: "설명" },
        { content: "", description: "설명" },
        { content: <div>슬롯</div>, description: "설명" },
        { content: undefined, description: "" },
      ];
      for (const [index, props] of cases.entries()) {
        const { unmount } = render(
          <Modal icon="check" title={`case-${index}`} actionLabel="확인" onAction={() => {}} {...props} />,
        );
        const describedBy = screen.getByRole("dialog", { name: `case-${index}` }).getAttribute("aria-describedby");
        if (describedBy !== null) expect(document.getElementById(describedBy)).not.toBeNull();
        unmount();
      }
    });

    it("두 인스턴스의 제목·설명 id는 서로 다르다", () => {
      render(
        <>
          <Modal icon="check" title="첫째" description="첫째 설명" actionLabel="확인" onAction={() => {}} />
          <Modal icon="email" title="둘째" description="둘째 설명" actionLabel="확인" onAction={() => {}} />
        </>,
      );

      const first = screen.getByRole("dialog", { name: "첫째" });
      const second = screen.getByRole("dialog", { name: "둘째" });
      expect(first.getAttribute("aria-labelledby")).not.toBe(second.getAttribute("aria-labelledby"));
      expect(first.getAttribute("aria-describedby")).not.toBe(second.getAttribute("aria-describedby"));
      expect(first).toHaveAccessibleDescription("첫째 설명");
      expect(second).toHaveAccessibleDescription("둘째 설명");
    });

    // 가입 동의 게이트(2026-10-26, design-agent P2): 제목·설명에 `break-keep`만 추가됐다(한글 어절 단위 줄바꿈).
    // 그 밖의 클래스는 그대로다.
    it("className은 바뀌지 않는다(시각 변화 0, 제목·설명 break-keep 추가분 제외)", () => {
      const { rerender } = render(
        <Modal icon="check" title="제목" description="설명" actionLabel="확인" onAction={() => {}} />,
      );

      const dialog = screen.getByRole("dialog", { name: "제목" });
      expect(dialog.className).toBe(
        "bg-bg-canvas border-modal-border w-[342px] overflow-hidden rounded-[28px] border shadow-[0px_6px_0px_0px_rgba(35,43,56,0.22),0px_18px_32px_0px_rgba(35,43,56,0.21),0px_34px_56px_0px_rgba(35,43,56,0.11)]",
      );
      expect(screen.getByRole("heading", { name: "제목" }).className).toBe(
        "text-label-primary text-center text-[19px] font-bold break-keep",
      );
      expect(screen.getByText("설명").className).toBe("text-modal-subtitle text-center text-sm break-keep");
      expect(screen.getByText("설명").tagName).toBe("P");

      rerender(<Modal icon="check" title="제목" description="설명" wide actionLabel="확인" onAction={() => {}} />);
      expect(screen.getByRole("dialog", { name: "제목" }).className).toBe(
        "bg-bg-canvas border-modal-border w-[690px] max-w-[calc(100%-3rem)] overflow-hidden rounded-[28px] border shadow-[0px_6px_0px_0px_rgba(35,43,56,0.22),0px_18px_32px_0px_rgba(35,43,56,0.21),0px_34px_56px_0px_rgba(35,43,56,0.11),inset_0px_2px_0px_1px_rgba(255,255,255,0.9),inset_0px_-2px_0px_1px_rgba(35,43,56,0.07)]",
      );
    });
  });

  describe("initialFocus", () => {
    it("기본값은 기존과 같이 주 액션 버튼에 포커스를 준다(2버튼)", () => {
      render(
        <Modal
          icon="error"
          title="삭제할까요?"
          description="설명"
          actionLabel="삭제"
          onAction={() => {}}
          cancelLabel="취소"
          onCancel={() => {}}
        />,
      );

      expect(screen.getByRole("button", { name: "삭제" })).toHaveFocus();
    });

    it("initialFocus='cancel'이면 취소 버튼에 포커스를 준다", () => {
      render(
        <Modal
          icon="error"
          title="삭제할까요?"
          description="설명"
          actionLabel="삭제"
          onAction={() => {}}
          cancelLabel="취소"
          onCancel={() => {}}
          initialFocus="cancel"
        />,
      );

      expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    });

    it("initialFocus='cancel'이라도 취소 버튼이 없는 1버튼 레이아웃이면 주 액션에 포커스를 준다", () => {
      render(
        <Modal icon="check" title="완료" description="설명" actionLabel="확인" onAction={() => {}} initialFocus="cancel" />,
      );

      expect(screen.getByRole("button", { name: "확인" })).toHaveFocus();
    });

    it("initialFocus='cancel'에서 Enter로 취소가 눌려도 주 액션은 실행되지 않는다", () => {
      const onAction = vi.fn();
      const onCancel = vi.fn();
      render(
        <Modal
          icon="error"
          title="삭제할까요?"
          description="설명"
          actionLabel="삭제"
          onAction={onAction}
          cancelLabel="취소"
          onCancel={onCancel}
          initialFocus="cancel"
        />,
      );

      const focused = document.activeElement;
      expect(focused).toBeInstanceOf(HTMLButtonElement);
      fireEvent.click(focused as HTMLButtonElement);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onAction).not.toHaveBeenCalled();
    });
  });
});
