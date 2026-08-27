import { z } from "zod";
import { referenceDifficultySchema } from "../referenceAnalysis/referenceItemFeatureSchema";

/** 원문 발췌를 물리적으로 방지하기 위한 짧은 서술 필드 공통 길이 제한(Stage 2와 동일). */
const SHORT_ABSTRACTED_TEXT_MAX_LENGTH = 200;

/** `exam_item_features.subject_mapping` 값. DB CHECK와 동일한 3개 값. */
export const examSubjectMappingSchema = z.enum(["ALG", "CALC1", "OUT_OF_CURRENT_SCOPE"]);
export type ExamSubjectMapping = z.infer<typeof examSubjectMappingSchema>;

export const examRepresentationTypeSchema = z.enum([
  "expression",
  "equation",
  "inequality",
  "graph",
  "function_relation",
  "word_situation",
  "mixed",
]);
export type ExamRepresentationType = z.infer<typeof examRepresentationTypeSchema>;

export const examCalculationLoadSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type ExamCalculationLoad = z.infer<typeof examCalculationLoadSchema>;

export const examConditionInterpretationLoadSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type ExamConditionInterpretationLoad = z.infer<typeof examConditionInterpretationLoadSchema>;

/**
 * 현재(2022 개정) 교육과정과의 호환성. GOLD 항목이면서 `subject_mapping='OUT_OF_CURRENT_SCOPE'`
 * (확률과 통계 등 PocketQ 범위 밖)이면 이 판정 자체가 의미가 없으므로 반드시 null이어야 한다.
 */
export const curriculumCompatibilitySchema = z.enum([
  "DIRECT_COMPATIBLE",
  "PARTIAL_COMPATIBLE",
  "INCOMPATIBLE",
  "UNCERTAIN",
]);
export type CurriculumCompatibility = z.infer<typeof curriculumCompatibilitySchema>;

export const examItemReviewStatusSchema = z.enum(["NEEDS_REVIEW", "REVIEWED_OK", "REVIEWED_REJECTED"]);
export type ExamItemReviewStatus = z.infer<typeof examItemReviewStatusSchema>;

const abstractedShortText = z.string().max(SHORT_ABSTRACTED_TEXT_MAX_LENGTH).nullable();

/**
 * `exam_item_features` 테이블 한 행에 대응하는 입력 shape.
 *
 * 이 스키마는 문항의 원문 전체를 담는 필드를 절대 포함하지 않는다 — 오직 추상화된 구조적
 * 특징(개념/추론 패턴/배점 등)만 다룬다. `primaryConcept`는 200자 제한으로 원문 발췌 자체를
 * 물리적으로 어렵게 만든다.
 */
export const examItemFeatureSchema = z
  .object({
    examReferenceSetId: z.string().min(1),
    itemNumber: z.number().int().positive(),
    subjectMapping: examSubjectMappingSchema,
    curriculumNodeCodes: z.array(z.string().min(1)),
    primaryConcept: abstractedShortText,
    secondaryConcepts: z.array(z.string().min(1)).nullable(),
    requiredSkills: z.array(z.string().min(1)).nullable(),
    prerequisiteSkills: z.array(z.string().min(1)).nullable(),
    representationType: examRepresentationTypeSchema.nullable(),
    reasoningSignature: z.string().nullable(),
    reasoningStepCount: z.number().int().min(0).nullable(),
    calculationLoad: examCalculationLoadSchema.nullable(),
    conceptLoad: z.number().int().min(0).nullable(),
    conditionInterpretationLoad: examConditionInterpretationLoadSchema.nullable(),
    caseSplitRequired: z.boolean(),
    representationConversion: z.boolean(),
    nonObviousTransformation: z.boolean(),
    answerFormat: z.string().nullable(),
    /** 정답표의 배점(1~10점). 원문 아닌 순수 숫자 메타데이터. */
    officialPointValue: z.number().int().min(1).max(10).nullable(),
    curriculumCompatibility: curriculumCompatibilitySchema.nullable(),
    extractionConfidence: z.number().min(0).max(1).nullable(),
    reviewStatus: examItemReviewStatusSchema,
  })
  .refine(
    (value) => value.subjectMapping !== "OUT_OF_CURRENT_SCOPE" || value.curriculumCompatibility === null,
    {
      message: "subjectMapping이 OUT_OF_CURRENT_SCOPE이면 curriculumCompatibility는 반드시 null이어야 합니다.",
      path: ["curriculumCompatibility"],
    },
  );
export type ExamItemFeatureInput = z.infer<typeof examItemFeatureSchema>;

/** 참고용 난이도 재수출(examDifficultyEstimate 등에서 재사용). */
export { referenceDifficultySchema };
