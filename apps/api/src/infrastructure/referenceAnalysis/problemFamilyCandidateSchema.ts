import { z } from "zod";
import { referenceDifficultySchema } from "./referenceItemFeatureSchema";

/** 원문 발췌를 물리적으로 방지하기 위한 추상화 서술 원소 최대 길이. */
const CANONICAL_STEP_MAX_LENGTH = 200;

/**
 * `problem_family_candidates.status` 값.
 * 절대 "production-approved"류 상태를 표현하지 않는다 — 이 3개 값이 전부다.
 */
export const familyCandidateStatusSchema = z.enum(["CANDIDATE", "REVIEW_REQUIRED", "REJECTED"]);
export type FamilyCandidateStatus = z.infer<typeof familyCandidateStatusSchema>;

/**
 * `problem_family_candidates` 테이블 한 행에 대응하는 입력 shape.
 *
 * `canonicalReasoningSteps`는 추론 구조를 추상화한 서술만 담아야 한다(원문 발췌 금지).
 * 각 원소는 200자 제한으로 물리적으로도 원문 전체 발췌를 어렵게 한다.
 */
export const problemFamilyCandidateSchema = z
  .object({
    candidateCode: z.string().min(1),
    subject: z.string().min(1),
    unit: z.string().nullable(),
    curriculumNodeCodes: z.array(z.string().min(1)).nullable(),
    familyName: z.string().min(1),
    coreConcept: z.string().min(1),
    requiredSkills: z.array(z.string().min(1)).nullable(),
    reasoningSignature: z.string().min(1),
    canonicalReasoningSteps: z.array(z.string().min(1).max(CANONICAL_STEP_MAX_LENGTH)).nullable(),
    representationTypes: z.array(z.string().min(1)).nullable(),
    prerequisiteNodes: z.array(z.string().min(1)).nullable(),
    approximateDifficultyMin: referenceDifficultySchema.nullable(),
    approximateDifficultyMax: referenceDifficultySchema.nullable(),
    sourceItemCount: z.number().int().min(0),
    evidenceItemKeys: z.array(z.string().min(1)).nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    status: familyCandidateStatusSchema,
  })
  .refine(
    (value) => {
      const order: Record<string, number> = { D1: 1, D2: 2, D3: 3, D4: 4, D5: 5, UNKNOWN: 0 };
      const min = value.approximateDifficultyMin;
      const max = value.approximateDifficultyMax;
      if (!min || !max || min === "UNKNOWN" || max === "UNKNOWN") return true;
      return order[min]! <= order[max]!;
    },
    {
      message: "approximateDifficultyMin은 approximateDifficultyMax보다 클 수 없습니다.",
      path: ["approximateDifficultyMax"],
    },
  );
export type ProblemFamilyCandidateInput = z.infer<typeof problemFamilyCandidateSchema>;
