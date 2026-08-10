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
});
