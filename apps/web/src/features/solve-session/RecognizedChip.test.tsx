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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
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
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
      />,
    );

    const button = screen.getByRole("button", { name: "인식된 문제 확대" });
    // 18px 시각 슬롯 기준 세로는 상하 13px씩 확장 = 44px(18 + 13*2)까지 탭 영역을 넓힌다.
    expect(button).toHaveClass("before:-inset-y-[13px]");
  });

  it("토글 버튼의 탭 영역은 '인식 취소' 버튼 쪽(왼쪽)으로는 gap(8px)을 넘어 침범하지 않고, 반대쪽(오른쪽)으로만 더 넓게 보상한다(design-agent 사후검수에서 발견한 클릭 겹침 버그 수정 — 이전에는 사방 동일한 13px 확장이 gap 8px를 넘어 '인식 취소' 버튼 우측 5px를 침범해 그 영역에서 chevron이 클릭을 가로챘다)", () => {
    render(
      <RecognizedChip
        recognizedText="1+1=?"
        isExpanded={false}
        onToggleExpand={() => {}}
        onCancelRecognition={() => {}}
        isCancelDisabled={false}
        inputMode="photo"
      />,
    );

    const button = screen.getByRole("button", { name: "인식된 문제 확대" });
    // 왼쪽(인식 취소 버튼 방향) 확장은 정확히 gap(8px)까지만 — 이보다 크면 gap을 넘어 인식 취소
    // 버튼의 히트박스(가로 확장 없는 88px 폭)를 침범한다.
    expect(button).toHaveClass("before:-left-[8px]");
    // 오른쪽(침범 대상이 없는 바깥쪽)은 왼쪽이 줄어든 만큼 더 확장해 44px 최소 터치 타깃을
    // 보상한다: 시각 슬롯 18px + 좌 8px + 우 19px = 45px ≥ 44px.
    expect(button).toHaveClass("before:-right-[19px]");
    // 실제 버튼 박스 자체는 여전히 시각 슬롯과 동일한 18×18을 유지해야 한다 — 버튼 자신을
    // 비대칭으로 확장하면 내부 아이콘이 `items-center`에 의해 확장된 박스 중심으로 재정렬되어
    // 시각적으로 오른쪽으로 밀려 보이는 회귀가 생긴다. 확장은 `::before`(`before:` 접두사가 붙은
    // 클래스)로만 이뤄져야 한다.
    expect(button).toHaveClass("size-[18px]");
    expect(button).not.toHaveClass("-inset-[13px]");
  });

  describe("인식 취소 버튼(오너 UX 결정: 인식취소 상시 배치, Figma `310:1498` 실측)", () => {
    it("'인식 취소' 버튼을 누르면 onCancelRecognition이 호출된다", () => {
      const onCancelRecognition = vi.fn();
      render(
        <RecognizedChip
          recognizedText="1+1=?"
          isExpanded={false}
          onToggleExpand={() => {}}
          onCancelRecognition={onCancelRecognition}
          isCancelDisabled={false}
          inputMode="photo"
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "인식 취소" }));
      expect(onCancelRecognition).toHaveBeenCalledTimes(1);
    });

    it("isCancelDisabled가 true면 버튼이 비활성화되어 클릭해도 onCancelRecognition이 호출되지 않는다", () => {
      const onCancelRecognition = vi.fn();
      render(
        <RecognizedChip
          recognizedText="1+1=?"
          isExpanded={false}
          onToggleExpand={() => {}}
          onCancelRecognition={onCancelRecognition}
          isCancelDisabled
          inputMode="photo"
        />,
      );

      const button = screen.getByRole("button", { name: "인식 취소" });
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(onCancelRecognition).not.toHaveBeenCalled();
    });

    it("확장 상태에서도 '인식 취소' 버튼이 동일하게 렌더링된다", () => {
      render(
        <RecognizedChip
          recognizedText="1+1=?"
          isExpanded
          onToggleExpand={() => {}}
          onCancelRecognition={() => {}}
          isCancelDisabled={false}
          inputMode="photo"
        />,
      );

      expect(screen.getByRole("button", { name: "인식 취소" })).toBeInTheDocument();
    });

    it("고정 크기(88×30, Figma `310:1498` 실측)를 갖는다", () => {
      render(
        <RecognizedChip
          recognizedText="1+1=?"
          isExpanded={false}
          onToggleExpand={() => {}}
          onCancelRecognition={() => {}}
          isCancelDisabled={false}
          inputMode="photo"
        />,
      );

      const button = screen.getByRole("button", { name: "인식 취소" });
      expect(button).toHaveClass("h-[30px]");
      expect(button).toHaveClass("w-[88px]");
    });

    it("패딩을 0으로 없앨 때 important 수식자(`!`)를 쓴다(stage-qa-agent 실빌드 CSS+headless Chrome 재현 발견 회귀 테스트 — `px-0 py-0`만으로는 Tailwind v4가 유틸리티를 canonical 순서로 CSS에 배치해 빌드 산출물에서 `PILL_BASE_STYLE`의 `px-[26px] py-[11px]`가 동일 specificity에서 나중에 나와 실제로 이겨 텍스트가 2줄로 줄바꿈되며 30px 다크 필 배경 위아래로 흘러넘쳤다. jsdom은 이 캐스케이드 승패까지는 검증하지 못하므로, 여기서는 올바른 수정 방식(`!` important 수식자)이 클래스명에 반영됐는지만 검증한다 — 실제 승패는 `pnpm --filter web build` 산출물 CSS를 headless Chrome으로 재현해 확인해야 한다)", () => {
      render(
        <RecognizedChip
          recognizedText="1+1=?"
          isExpanded={false}
          onToggleExpand={() => {}}
          onCancelRecognition={() => {}}
          isCancelDisabled={false}
          inputMode="photo"
        />,
      );

      const button = screen.getByRole("button", { name: "인식 취소" });
      expect(button).toHaveClass("!px-0");
      expect(button).toHaveClass("!py-0");
      expect(button).not.toHaveClass("px-0");
      expect(button).not.toHaveClass("py-0");
    });
  });

  describe("inputMode에 따른 버튼 라벨 분기(Figma 플로우 조사, design-agent 2단계 handback)", () => {
    it("inputMode='handwriting'이면 버튼 라벨이 '인식 수정'이다", () => {
      render(
        <RecognizedChip
          recognizedText="1+1=?"
          isExpanded={false}
          onToggleExpand={() => {}}
          onCancelRecognition={() => {}}
          isCancelDisabled={false}
          inputMode="handwriting"
        />,
      );

      expect(screen.getByRole("button", { name: "인식 수정" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "인식 취소" })).not.toBeInTheDocument();
    });

    it("inputMode='photo'(기존 케이스)면 버튼 라벨이 '인식 취소'로 유지된다", () => {
      render(
        <RecognizedChip
          recognizedText="1+1=?"
          isExpanded={false}
          onToggleExpand={() => {}}
          onCancelRecognition={() => {}}
          isCancelDisabled={false}
          inputMode="photo"
        />,
      );

      expect(screen.getByRole("button", { name: "인식 취소" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "인식 수정" })).not.toBeInTheDocument();
    });
  });
});
