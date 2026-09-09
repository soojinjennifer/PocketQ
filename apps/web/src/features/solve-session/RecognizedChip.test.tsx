import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecognizedChip } from "./RecognizedChip";

describe("RecognizedChip", () => {
  it("축소 상태에서 인식된 원문과 '인식됨' 배지를 보여준다", () => {
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded={false}
        onToggleExpand={() => {}}
      />,
    );

    expect(screen.getByText("인식됨")).toBeInTheDocument();
    expect(screen.getByText("1+1=?")).toBeInTheDocument();
  });

  it("배지/텍스트/토글 행은 items-start다(오너 iPad 실기기 발견 — 여러 줄로 감싸지는 긴 인식 텍스트일 때 items-center면 배지·토글이 문단 중간에 뜬다)", () => {
    render(
      <RecognizedChip
        recognizedText="21. 수열 {a_n}의 모든 항은 자연수이고, 모든 자연수 n에 대하여 다음 조건을 만족시킨다."
        isExpanded={false}
        onToggleExpand={() => {}}
      />,
    );

    const row = screen.getByText("인식됨").closest("div[class*='items-']");
    expect(row).toHaveClass("items-start");
    expect(row).not.toHaveClass("items-center");
  });

  it("모서리 반경 14px을 갖는다(Figma 정식 컴포넌트 `310:1498`, 오너 결정, rounded-full 아님)", () => {
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded={false}
        onToggleExpand={() => {}}
      />,
    );

    const chip = screen.getByText("1+1=?").closest("div[class*='bg-glass-fill']");
    expect(chip).toHaveClass("rounded-[14px]");
    expect(chip).not.toHaveClass("rounded-full");
  });

  it("축소 상태의 Summary 텍스트는 1줄 말줄임(ellipsis) 처리된다(오너 결정) — 컨테이너 폭 제약과 함께 검증한다", () => {
    render(
      <RecognizedChip
        recognizedText="아주 긴 인식 결과 텍스트가 한 줄을 넘어가는 경우를 가정한 문장입니다"
        isExpanded={false}
        onToggleExpand={() => {}}
      />,
    );

    const text = screen.getByText("아주 긴 인식 결과 텍스트가 한 줄을 넘어가는 경우를 가정한 문장입니다");
    // jsdom은 실제 레이아웃을 계산하지 않으므로 화면에 그려진 결과(말줄임이 실제로 잘리는 모습)
    // 자체를 단정할 수는 없다 — 대신 말줄임이 "동작할 수 있는 조건"이 실제로 갖춰졌는지를
    // 검증한다: `truncate`(overflow:hidden + text-overflow:ellipsis + white-space:nowrap)는
    // 대상 요소에 유한한 너비가 있을 때만 의미가 있다. flex 자식인 이 텍스트는 `min-w-0 flex-1`로
    // 부모 flex 트랙 폭까지만 줄어들 수 있는데, 그 부모(칩 컨테이너) 자체가 폭 제약이 없으면
    // flex 트랙 폭도 콘텐츠 크기만큼 늘어나 버려 `truncate`가 잘라낼 대상이 사라진다
    // (design-agent 사후검수에서 실제로 발견한 결함 — 이전 컨테이너에는 `w-[...]`가 전혀 없었다).
    // 그래서 텍스트의 truncate 클래스뿐 아니라, 그 truncate가 실제로 걸릴 수 있게 하는 상위
    // 컨테이너의 고정 폭(`w-[400px]`, Figma `250:56` 실측)까지 함께 확인한다.
    expect(text).toHaveClass("truncate");
    expect(text).toHaveClass("min-w-0");
    expect(text).toHaveClass("flex-1");
    const chip = text.closest("div[class*='bg-glass-fill']");
    expect(chip).toHaveClass("w-[400px]");
    // 중간 row(배지+텍스트+토글을 담는 `flex items-start` div)에 `w-full`이 없으면 row가 flex item
    // 기본값(`flex-grow:0`)에 따라 콘텐츠 크기만큼 늘어나 바깥 400px 박스를 넘어 텍스트가 삐져나가는
    // 결함이 있었다(오너 iPad 실기기 스크린샷 발견) — 이 회귀를 잡기 위해 row 자체의 `w-full`도
    // 함께 검증한다.
    const row = text.closest("div[class*='items-start']");
    expect(row).toHaveClass("w-full");
  });

  it("확장 버튼을 누르면 onToggleExpand가 호출된다", () => {
    const onToggleExpand = vi.fn();
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded={false}
        onToggleExpand={onToggleExpand}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "인식된 문제 확대" }));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it("확장 상태(필기 입력, imageUrl 없음)에서는 인식된 텍스트 전체를 보여준다", () => {
    render(
      <RecognizedChip
        recognizedText="긴 필기 인식 결과 텍스트"
        isExpanded
        onToggleExpand={() => {}}
      />,
    );

    expect(screen.getByText("긴 필기 인식 결과 텍스트")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "인식된 문제 축소" })).toBeInTheDocument();
  });

  it("확장 상태(사진 입력, imageUrl 있음)에서는 확대된 원본 이미지를 보여준다", () => {
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded
        onToggleExpand={() => {}}
        imageUrl="blob:mock-preview-url"
      />,
    );

    const image = screen.getByRole("img", { name: "촬영한 문제" });
    expect(image).toHaveAttribute("src", "blob:mock-preview-url");
  });

  it("확장 상태 카드는 Figma 정식 컴포넌트 실측 폭(400px, node `310:1499`)에 대응하는 클래스를 갖는다", () => {
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded
        onToggleExpand={() => {}}
      />,
    );

    const card = screen.getByText("인식됨").closest("div[class*='w-[400px]']");
    expect(card).toHaveClass("w-[400px]");
  });

  it("확장 카드는 좁은 화면에서 뷰포트를 벗어나지 않도록 max-width 안전장치를 갖는다", () => {
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded
        onToggleExpand={() => {}}
      />,
    );

    const card = screen.getByText("인식됨").closest("div[class*='w-[400px]']");
    expect(card).toHaveClass("max-w-[calc(100vw-32px)]");
  });

  it("토글 버튼의 시각적 아이콘은 18px이지만 실제 탭 영역은 PRD 최소 터치 타깃(44px)에 맞춰 넓다", () => {
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded={false}
        onToggleExpand={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "인식된 문제 확대" });
    // 18px 시각 슬롯 기준 상하좌우 13px씩 확장 = 44px(18 + 13*2)까지 탭 영역을 넓힌다.
    expect(button).toHaveClass("-inset-[13px]");
  });
});
