import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordResetModal } from "./PasswordResetModal";

function fillPasswords(newPassword: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: newPassword } });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: confirmPassword } });
}

describe("PasswordResetModal — phase=code", () => {
  it("이메일을 노출하는 부제와 8자리 코드 입력란(numeric)을 렌더링한다(AUTH-10)", () => {
    render(
      <PasswordResetModal
        phase="code"
        email="student@example.com"
        onVerifyCode={vi.fn()}
        onResend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("인증 코드 입력")).toBeInTheDocument();
    expect(screen.getByText("student@example.com로 보낸 인증 코드를 입력해 주세요")).toBeInTheDocument();
    const codeInput = screen.getByPlaceholderText("인증 코드 8자리 입력");
    expect(codeInput).toHaveAttribute("inputmode", "numeric");
    expect(codeInput).toHaveAttribute("maxlength", "8");
  });

  it("마운트 시 코드 입력 필드에 포커스를 이동한다(AUTH-10)", () => {
    render(
      <PasswordResetModal
        phase="code"
        email="student@example.com"
        onVerifyCode={vi.fn()}
        onResend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("인증 코드 8자리 입력")).toHaveFocus();
  });

  it("코드를 입력하고 확인을 누르면 onVerifyCode를 호출한다(AUTH-10)", async () => {
    const onVerifyCode = vi.fn().mockResolvedValue({ error: null });
    render(
      <PasswordResetModal
        phase="code"
        email="student@example.com"
        onVerifyCode={onVerifyCode}
        onResend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("인증 코드 8자리 입력"), {
      target: { value: "12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => expect(onVerifyCode).toHaveBeenCalledWith("12345678"));
  });

  it("onVerifyCode가 실패하면 팝업을 닫지 않고 오류 메시지를 표시한다(AUTH-10)", async () => {
    const onVerifyCode = vi.fn().mockResolvedValue({
      error: "인증 코드가 올바르지 않거나 만료됐어요",
    });
    render(
      <PasswordResetModal
        phase="code"
        email="student@example.com"
        onVerifyCode={onVerifyCode}
        onResend={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("인증 코드 8자리 입력"), {
      target: { value: "00000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("인증 코드가 올바르지 않거나 만료됐어요")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("'코드 다시 받기' 클릭 시 onResend를 호출한다(AUTH-10)", async () => {
    const onResend = vi.fn().mockResolvedValue({ error: null });
    render(
      <PasswordResetModal
        phase="code"
        email="student@example.com"
        onVerifyCode={vi.fn()}
        onResend={onResend}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "코드 다시 받기" }));

    await waitFor(() => expect(onResend).toHaveBeenCalledTimes(1));
  });

  it("'로그인 화면으로 돌아가기'를 누르면 onCancel을 호출한다(AUTH-10)", () => {
    const onCancel = vi.fn();
    render(
      <PasswordResetModal
        phase="code"
        email="student@example.com"
        onVerifyCode={vi.fn()}
        onResend={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "로그인 화면으로 돌아가기" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("PasswordResetModal — phase=password", () => {
  it("이메일을 노출하는 부제를 렌더링한다(AUTH-10)", () => {
    render(
      <PasswordResetModal
        phase="password"
        email="student@example.com"
        onSubmitPassword={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("새 비밀번호 설정")).toBeInTheDocument();
    expect(screen.getByText("student@example.com의 새 비밀번호를 설정해 주세요")).toBeInTheDocument();
  });

  it("마운트 시 새 비밀번호 입력 필드에 포커스를 이동한다(AUTH-10)", () => {
    render(
      <PasswordResetModal
        phase="password"
        email="student@example.com"
        onSubmitPassword={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("새 비밀번호")).toHaveFocus();
  });

  it("두 입력값이 다르면 제출을 차단하고 불일치 오류를 표시한다(AUTH-10)", async () => {
    const onSubmitPassword = vi.fn().mockResolvedValue({ error: null });
    render(
      <PasswordResetModal
        phase="password"
        email="student@example.com"
        onSubmitPassword={onSubmitPassword}
        onCancel={vi.fn()}
      />,
    );

    fillPasswords("new-pw-1234", "new-pw-9999");
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));

    expect(await screen.findByText("비밀번호가 일치하지 않습니다")).toBeInTheDocument();
    expect(onSubmitPassword).not.toHaveBeenCalled();
  });

  it("두 입력값이 같으면 새 비밀번호로 onSubmitPassword를 호출한다(AUTH-10)", async () => {
    const onSubmitPassword = vi.fn().mockResolvedValue({ error: null });
    render(
      <PasswordResetModal
        phase="password"
        email="student@example.com"
        onSubmitPassword={onSubmitPassword}
        onCancel={vi.fn()}
      />,
    );

    fillPasswords("new-pw-1234", "new-pw-1234");
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));

    await waitFor(() => expect(onSubmitPassword).toHaveBeenCalledWith("new-pw-1234"));
    expect(screen.queryByText("비밀번호가 일치하지 않습니다")).not.toBeInTheDocument();
  });

  it("onSubmitPassword가 실패하면 팝업 안에 오류 메시지를 표시한다(AUTH-10)", async () => {
    const onSubmitPassword = vi.fn().mockResolvedValue({ error: "비밀번호가 너무 짧습니다." });
    render(
      <PasswordResetModal
        phase="password"
        email="student@example.com"
        onSubmitPassword={onSubmitPassword}
        onCancel={vi.fn()}
      />,
    );

    fillPasswords("short", "short");
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경하기" }));

    expect(await screen.findByText("비밀번호가 너무 짧습니다.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("'로그인 화면으로 돌아가기'를 누르면 onCancel을 호출한다(제출 없이 나가는 유일한 경로, design-agent 사후검수 M1)", () => {
    const onCancel = vi.fn();
    render(
      <PasswordResetModal
        phase="password"
        email="student@example.com"
        onSubmitPassword={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "로그인 화면으로 돌아가기" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
