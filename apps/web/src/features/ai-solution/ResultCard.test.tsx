import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultCard } from "./ResultCard";

describe("ResultCard", () => {
  it("concept variant는 '관련 개념' 라벨과 본문을 보여준다", () => {
    render(<ResultCard kind="concept" body="이차함수의 최댓값은 꼭짓점에서 결정된다." />);

    expect(screen.getByText("관련 개념")).toBeInTheDocument();
    expect(screen.getByText("이차함수의 최댓값은 꼭짓점에서 결정된다.")).toBeInTheDocument();
  });

  it("steps variant는 '단계별 풀이' 라벨을 보여준다", () => {
    render(<ResultCard kind="steps" body="1단계: 이차식을 인수분해한다." />);

    expect(screen.getByText("단계별 풀이")).toBeInTheDocument();
  });

  it("본문에 포함된 인라인 수식(\\( \\))을 KaTeX로 렌더링한다", () => {
    const { container } = render(<ResultCard kind="concept" body={"정답은 \\(x=2\\)입니다."} />);

    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("KaTeX 렌더링이 실패해도 원본 텍스트가 그대로 표시된다", () => {
    render(<ResultCard kind="concept" body={"깨진 수식 \\(\\frac{1\\)입니다."} />);

    expect(screen.getByText(/깨진 수식/)).toBeInTheDocument();
  });

  it("title prop을 전달하면 라벨과 본문 사이에 제목이 렌더링된다", () => {
    render(<ResultCard kind="concept" title="이차함수의 최댓값" body="꼭짓점에서 결정된다." />);

    expect(screen.getByText("이차함수의 최댓값")).toBeInTheDocument();
  });

  it("title prop을 전달하지 않으면 제목이 렌더링되지 않는다", () => {
    render(<ResultCard kind="concept" body="꼭짓점에서 결정된다." />);

    expect(screen.queryByText("이차함수의 최댓값")).not.toBeInTheDocument();
  });
});
