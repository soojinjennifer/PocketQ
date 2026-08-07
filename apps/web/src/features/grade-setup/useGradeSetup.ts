import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../shared/lib/supabase/client";

/** PRD `docs/PRD_WHYMATH.md` §7 데이터 모델 grade 표기(M1~M3, H1~H3)를 그대로 따른다. */
export type Grade = "M1" | "M2" | "M3" | "H1" | "H2" | "H3";

export interface GradeOption {
  value: Grade;
  label: string;
}

export const GRADE_OPTIONS: GradeOption[] = [
  { value: "M1", label: "중1" },
  { value: "M2", label: "중2" },
  { value: "M3", label: "중3" },
  { value: "H1", label: "고1" },
  { value: "H2", label: "고2" },
  { value: "H3", label: "고3" },
];

/**
 * 학년 설정(GRADE-1) 로직. 선택한 학년을 Supabase 사용자 메타데이터(user_metadata.grade)에
 * 저장하고 성공 시 /solve/pencilcanvas로 이동한다. 실패 시 오류 메시지를 반환한다.
 */
export function useGradeSetup() {
  const navigate = useNavigate();
  const [pendingGrade, setPendingGrade] = useState<Grade | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = pendingGrade !== null;

  const selectGrade = useCallback(
    async (grade: Grade) => {
      setErrorMessage(null);
      setPendingGrade(grade);
      const { error } = await supabase.auth.updateUser({ data: { grade } });
      setPendingGrade(null);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      void navigate("/solve/pencilcanvas", { replace: true });
    },
    [navigate],
  );

  return { gradeOptions: GRADE_OPTIONS, pendingGrade, isSubmitting, errorMessage, selectGrade };
}
