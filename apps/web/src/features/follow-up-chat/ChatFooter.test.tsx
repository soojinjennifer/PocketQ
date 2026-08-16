import { createRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatFooter, type ChatFooterHandle } from "./ChatFooter";

describe("ChatFooter", () => {
  it("해시태그가 있으면 '#' 접두사를 붙여 렌더링하고, 없으면 pill 행을 렌더링하지 않는다", () => {
    const { rerender } = render(
      <ChatFooter hashtags={["이차방정식"]} status="idle" errorMessage={null} onSend={vi.fn()} />,
    );
    expect(screen.getByText("#이차방정식")).toBeInTheDocument();

    rerender(<ChatFooter hashtags={[]} status="idle" errorMessage={null} onSend={vi.fn()} />);
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
  });

  it("입력값이 비어 있으면 전송 버튼이 disabled다", () => {
    render(<ChatFooter hashtags={[]} status="idle" errorMessage={null} onSend={vi.fn()} />);

    expect(screen.getByRole("button", { name: "질문 보내기" })).toBeDisabled();
  });

  it("입력 후 전송 버튼을 클릭하면 onSend가 trim된 값으로 호출되고, 성공하면 입력값이 비워진다", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<ChatFooter hashtags={[]} status="idle" errorMessage={null} onSend={onSend} />);

    const input = screen.getByLabelText("후속 질문 입력");
    fireEvent.change(input, { target: { value: "  왜 이렇게 풀어요?  " } });
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith("  왜 이렇게 풀어요?  "));
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("전송이 실패하면 입력값을 그대로 유지한다", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    render(<ChatFooter hashtags={[]} status="idle" errorMessage={null} onSend={onSend} />);

    const input = screen.getByLabelText("후속 질문 입력");
    fireEvent.change(input, { target: { value: "질문" } });
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue("질문");
  });

  it("Enter 키로도 제출할 수 있다", async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<ChatFooter hashtags={[]} status="idle" errorMessage={null} onSend={onSend} />);

    const input = screen.getByLabelText("후속 질문 입력");
    fireEvent.change(input, { target: { value: "질문" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onSend).toHaveBeenCalledWith("질문"));
  });

  it("errorMessage가 있으면 화면에 표시한다", () => {
    render(
      <ChatFooter hashtags={[]} status="error" errorMessage="답변을 받지 못했습니다." onSend={vi.fn()} />,
    );

    expect(screen.getByText("답변을 받지 못했습니다.")).toBeInTheDocument();
  });

  it("status=submitting이면 입력창이 비활성화된다", () => {
    render(<ChatFooter hashtags={[]} status="submitting" errorMessage={null} onSend={vi.fn()} />);

    expect(screen.getByLabelText("후속 질문 입력")).toBeDisabled();
  });

  it("ref.fillAndFocus를 호출하면 입력값이 채워지고 입력창에 포커스된다(제안 질문 pill 인터랙션)", () => {
    const ref = createRef<ChatFooterHandle>();
    render(<ChatFooter ref={ref} hashtags={[]} status="idle" errorMessage={null} onSend={vi.fn()} />);

    act(() => {
      ref.current?.fillAndFocus("이 문제 왜 이렇게 풀어요?");
    });

    const input = screen.getByLabelText("후속 질문 입력");
    expect(input).toHaveValue("이 문제 왜 이렇게 풀어요?");
    expect(input).toHaveFocus();
  });

  it("onHashtagClick이 있으면 해시태그 pill이 클릭 가능한 버튼으로 렌더링되고 클릭 시 태그와 함께 호출된다", () => {
    const onHashtagClick = vi.fn();
    render(
      <ChatFooter
        hashtags={["이차방정식"]}
        status="idle"
        errorMessage={null}
        onSend={vi.fn()}
        onHashtagClick={onHashtagClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "#이차방정식" }));

    expect(onHashtagClick).toHaveBeenCalledWith("이차방정식");
  });

  it("onHashtagClick이 없으면 해시태그 pill은 클릭 불가능한 정적 표시(span)로 렌더링된다", () => {
    render(<ChatFooter hashtags={["이차방정식"]} status="idle" errorMessage={null} onSend={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "#이차방정식" })).not.toBeInTheDocument();
    expect(screen.getByText("#이차방정식")).toBeInTheDocument();
  });
});
