import { z } from "zod";
import { curriculumCompatibilitySchema } from "./examItemFeatureSchema";

/**
 * `problem_family_evidence.match_type` 값. `NONE`은 "매치 아님"을 뜻하며, 결정에 따라
 * 실제로는 이 테이블에 저장하지 않는다(비-증거를 증거 테이블에 넣지 않음) — 하지만 순수
 * 함수(`examEvidenceMatching.ts`)의 반환값으로는 계속 존재해야 리포트 집계(Family Gap Count)가
 * 가능하므로 스키마 자체는 5개 값을 모두 허용한다.
 */
export const evidenceMatchTypeSchema = z.enum(["DIRECT", "PARTIAL", "COMPOSITE", "WEAK", "NONE"]);
export type EvidenceMatchType = z.infer<typeof evidenceMatchTypeSchema>;

/**
 * `problem_family_evidence` 테이블 한 행에 대응하는 입력 shape.
 * `match_type='NONE'`인 값은 저장소(`examCalibrationRepository.saveProblemFamilyEvidence`)
 * 호출 전에 반드시 필터링되어야 한다(호출부 책임, 이 스키마 자체는 막지 않는다 — 순수 함수
 * 결과를 그대로 검증하는 용도이기 때문).
 */
export const problemFamilyEvidenceSchema = z.object({
  familyId: z.string().min(1),
  examItemId: z.string().min(1),
  matchType: evidenceMatchTypeSchema,
  structuralSimilarity: z.number().min(0).max(1).nullable(),
  skillOverlap: z.number().min(0).max(1).nullable(),
  reasoningOverlap: z.number().min(0).max(1).nullable(),
  curriculumCompatibility: curriculumCompatibilitySchema.nullable(),
  evidenceWeight: z.number().min(0).max(1),
  notes: z.string().nullable(),
});
export type ProblemFamilyEvidenceInput = z.infer<typeof problemFamilyEvidenceSchema>;
