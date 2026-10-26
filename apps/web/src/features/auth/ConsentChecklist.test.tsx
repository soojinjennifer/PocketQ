import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConsentChecklist, CONSENT_INCOMPLETE_HINT } from "./ConsentChecklist";
import { EMPTY_CONSENT_STATE, type ConsentState } from "./signupConsent";

const AGE = "(필수) 만 14세 이상입니다";
const TERMS = "(필수) 이용약관에 동의합니다";
const PRIVACY = "(필수) 개인정보처리방침에 동의합니다";

function Harness({ onChange }: { onChange?: (next: ConsentState) => void }) {
  const [value, setValue] = useState<ConsentState>(EMPTY_CONSENT_STATE);
  return (
    <ConsentChecklist
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("ConsentChecklist", () => {
  it("fieldset + sr-only legend로 묶고, 체크박스 이름은 보이는 라벨 전체다(aria-label 없음)", () => {
    render(<Harness />);

    const group = screen.getByRole("group", { name: "가입 동의 (모두 필수)" });
    expect(group.tagName).toBe("FIELDSET");
    for (const name of [AGE, TERMS, PRIVACY]) {
      const checkbox = screen.getByRole("checkbox", { name });
      expect(checkbox).not.toBeChecked();
      expect(checkbox).not.toHaveAttribute("aria-label");
    }
  });

  it("라벨 문구를 누르면 해당 항목만 한 번 토글된다", () => {
    const handleChange = vi.fn();
    render(<Harness onChange={handleChange} />);

    fireEvent.click(screen.getByText("이용약관에 동의합니다"));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenLastCalledWith({ age14: false, terms: true, privacy: false });
    expect(screen.getByRole("checkbox", { name: TERMS })).toBeChecked();

    fireEvent.click(screen.getByText("이용약관에 동의합니다"));
    expect(screen.getByRole("checkbox", { name: TERMS })).not.toBeChecked();
  });

  it("체크박스를 직접 눌러도 한 번만 토글된다", () => {
    const handleChange = vi.fn();
    render(<Harness onChange={handleChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: AGE }));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("checkbox", { name: AGE })).toBeChecked();
  });

  it("약관·개인정보 '보기' 링크는 새 탭으로 열리고 sr-only로 대상과 (새 탭)을 알린다", () => {
    render(<Harness />);

    const terms = screen.getByRole("link", { name: "이용약관 보기 (새 탭)" });
    expect(terms).toHaveAttribute("href", "/terms.html");
    expect(terms).toHaveAttribute("target", "_blank");
    expect(terms).toHaveAttribute("rel", "noopener noreferrer");

    const privacy = screen.getByRole("link", { name: "개인정보처리방침 보기 (새 탭)" });
    expect(privacy).toHaveAttribute("href", "/privacy.html");
    expect(privacy).toHaveAttribute("target", "_blank");
    expect(privacy).toHaveAttribute("rel", "noopener noreferrer");

    // 나이 확인 행에는 링크가 없다.
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("'보기' 링크를 눌러도 체크 상태가 바뀌지 않는다(링크는 라벨 밖 형제 요소)", () => {
    const handleChange = vi.fn();
    render(<Harness onChange={handleChange} />);

    const link = screen.getByRole("link", { name: "이용약관 보기 (새 탭)" });
    expect(link.closest("label")).toBeNull();
    fireEvent.click(link);

    expect(handleChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: TERMS })).not.toBeChecked();
  });

  it("행과 링크는 44pt(min-h-11) 이상의 터치 타깃이다", () => {
    render(<Harness />);

    const label = screen.getByText("만 14세 이상입니다").closest("label");
    expect(label?.className).toContain("min-h-11");
    const link = screen.getByRole("link", { name: "이용약관 보기 (새 탭)" });
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("min-w-11");
  });

  it("disabled면 세 체크박스가 모두 비활성이다", () => {
    render(<ConsentChecklist value={EMPTY_CONSENT_STATE} onChange={() => undefined} disabled />);

    for (const name of [AGE, TERMS, PRIVACY]) {
      expect(screen.getByRole("checkbox", { name })).toBeDisabled();
    }
    const label = screen.getByText("만 14세 이상입니다").closest("label");
    expect(label).toHaveClass("cursor-not-allowed");
    expect(label).not.toHaveClass("cursor-pointer");
  });

  it("활성 상태의 행 라벨은 cursor-pointer다", () => {
    render(<ConsentChecklist value={EMPTY_CONSENT_STATE} onChange={() => undefined} />);

    const label = screen.getByText("만 14세 이상입니다").closest("label");
    expect(label).toHaveClass("cursor-pointer");
    expect(label).not.toHaveClass("cursor-not-allowed");
  });

  it("hintId를 넘기면 그 id로 sr-only 안내를 렌더한다", () => {
    render(<ConsentChecklist value={EMPTY_CONSENT_STATE} onChange={() => undefined} hintId="consent-hint" />);

    const hint = screen.getByText(CONSENT_INCOMPLETE_HINT);
    expect(hint).toHaveAttribute("id", "consent-hint");
    expect(hint.className).toContain("sr-only");
  });
});
