import { z } from "zod";
import { referenceDifficultySchema } from "../referenceAnalysis/referenceItemFeatureSchema";

/** `problem_family_calibration.csat_relevance_level` 값. */
export const csatRelevanceLevelSchema = z.enum(["CORE", "HIGH", "MEDIUM", "LOW", "REJECT"]);
export type CsatRelevanceLevel = z.infer<typeof csatRelevanceLevelSchema>;

/**
 * `problem_family_calibration.status` 값. 이 4개 값(CANDIDATE/APPROVED/REVIEW_REQUIRED/
 * REJECTED)만 존재하며, `APPROVED`는 프로젝트 전체에서 오직 이 테이블에만 존재한다 —
 * `problem_family_candidates.status`(Stage 2)에는 절대 쓰지 않는다.
 */
export const familyCalibrationStatusSchema = z.enum(["CANDIDATE", "APPROVED", "REVIEW_REQUIRED", "REJECTED"]);
export type FamilyCalibrationStatus = z.infer<typeof familyCalibrationStatusSchema>;

/**
 * `problem_family_calibration` 테이블 한 행에 대응하는 입력 shape.
 *
 * `difficultyMin <= difficultyMax` 순서 검증은 DB CHECK가 아니라 이 zod `.refine()`에서만
 * 강제한다(Stage 2 `problemFamilyCandidateSchema.ts`와 동일한 이유 — D1~D5/UNKNOWN enum
 * 순서는 Postgres CHECK로 자연스럽게 표현할 수 없음).
 */
export const problemFamilyCalibrationSchema = z
  .object({
    familyId: z.string().min(1),
    csatRelevanceScore: z.number().min(0).max(1),
    csatRelevanceLevel: csatRelevanceLevelSchema,
    difficultyCenter: referenceDifficultySchema.nullable(),
    difficultyMin: referenceDifficultySchema.nullable(),
    difficultyMax: referenceDifficultySchema.nullable(),
    goldEvidenceCount: z.number().int().min(0),
    silverEvidenceCount: z.number().int().min(0),
    coverageConfidence: z.number().min(0).max(1).nullable(),
    calibrationVersion: z.string().min(1),
    calibratedAt: z.string().min(1),
    status: familyCalibrationStatusSchema,
  })
  .refine(
    (value) => {
      const order: Record<string, number> = { D1: 1, D2: 2, D3: 3, D4: 4, D5: 5, UNKNOWN: 0 };
      const min = value.difficultyMin;
      const max = value.difficultyMax;
      if (!min || !max || min === "UNKNOWN" || max === "UNKNOWN") return true;
      return order[min]! <= order[max]!;
    },
    {
      message: "difficultyMin은 difficultyMax보다 클 수 없습니다.",
      path: ["difficultyMax"],
    },
  );
export type ProblemFamilyCalibrationInput = z.infer<typeof problemFamilyCalibrationSchema>;
