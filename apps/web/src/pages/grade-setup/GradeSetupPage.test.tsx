import { AuthApiError } from "@supabase/supabase-js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../shared/lib/supabase/client";
import { createFakeSession } from "../../test/supabaseTestUtils";
import { GradeSetupPage } from "./GradeSetupPage";

vi.mock("../../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderGradeSetupPage() {
  return render(
    <MemoryRouter initialEntries={["/grade-setup"]}>
      <Routes>
        <Route path="/grade-setup" element={<GradeSetupPage />} />
        <Route path="/solve/pencilcanvas" element={<div>SolvePage</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GradeSetupPage", () => {
  it("중1~중3, 고1~고3 6개 학년 버튼을 렌더링한다", () => {
    renderGradeSetupPage();
    ["중1", "중2", "중3", "고1", "고2", "고3"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("학년 버튼 클릭 시 updateUser를 grade 값과 함께 호출하고 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: createFakeSession().user },
      error: null,
    });

    renderGradeSetupPage();
    fireEvent.click(screen.getByRole("button", { name: "중1" }));

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { grade: "M1" } });
    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });

  it("고3 버튼 클릭 시 updateUser에 H3 값을 전달한다", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: createFakeSession().user },
      error: null,
    });

    renderGradeSetupPage();
    fireEvent.click(screen.getByRole("button", { name: "고3" }));

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ data: { grade: "H3" } });
    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });

  it("updateUser 실패 시 오류 메시지를 표시하고 이동하지 않는다", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("학년 저장에 실패했습니다.", 500, "unexpected_failure"),
    });

    renderGradeSetupPage();
    fireEvent.click(screen.getByRole("button", { name: "중2" }));

    expect(await screen.findByText("학년 저장에 실패했습니다.")).toBeInTheDocument();
    expect(screen.queryByText("SolvePage")).not.toBeInTheDocument();
  });

  it("처리 중에는 로딩 인디케이터를 표시한다", async () => {
    let resolveUpdate: (value: {
      data: { user: ReturnType<typeof createFakeSession>["user"] };
      error: null;
    }) => void = () => {};
    vi.mocked(supabase.auth.updateUser).mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    renderGradeSetupPage();
    fireEvent.click(screen.getByRole("button", { name: "중3" }));

    expect(await screen.findByText("처리 중")).toBeInTheDocument();

    resolveUpdate({ data: { user: createFakeSession().user }, error: null });
    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });
});
