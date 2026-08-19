import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputGroup } from "./Input";

describe("InputGroup", () => {
  it("inputMode/maxLength를 넘기지 않으면 기존과 동일하게(속성 없이) 렌더링한다(하위 호환)", () => {
    render(
      <InputGroup
        fields={[
          { name: "email", type: "email", placeholder: "이메일", value: "", onChange: vi.fn() },
        ]}
      />,
    );

    const input = screen.getByLabelText("이메일");
    expect(input).not.toHaveAttribute("inputmode");
    expect(input).not.toHaveAttribute("maxlength");
  });

  it("inputMode/maxLength를 넘기면 그대로 input에 전달한다", () => {
    render(
      <InputGroup
        fields={[
          {
            name: "code",
            placeholder: "인증 코드 8자리 입력",
            value: "",
            onChange: vi.fn(),
            inputMode: "numeric",
            maxLength: 8,
          },
        ]}
      />,
    );

    const input = screen.getByLabelText("인증 코드 8자리 입력");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("maxlength", "8");
  });
});
