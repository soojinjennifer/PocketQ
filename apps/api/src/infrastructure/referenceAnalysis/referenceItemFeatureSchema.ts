import { z } from "zod";

/** 원문 발췌를 물리적으로 방지하기 위한 짧은 서술 필드 공통 길이 제한. */
const SHORT_ABSTRACTED_TEXT_MAX_LENGTH = 200;

export const representationTypeSchema = z.enum([
  "expression",
  "equation",
  "inequality",
  "graph",
  "function_relation",
  "word_situation",
  "mixed",
]);
export type RepresentationType = z.infer<typeof representationTypeSchema>;

export const calculationLoadSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type CalculationLoad = z.infer<typeof calculationLoadSchema>;

/** 참고용 난이도 추정 등급. UNKNOWN 포함 6단계. */
export const referenceDifficultySchema = z.enum(["D1", "D2", "D3", "D4", "D5", "UNKNOWN"]);
export type ReferenceDifficulty = z.infer<typeof referenceDifficultySchema>;

export const reviewStatusSchema = z.enum(["NEEDS_REVIEW", "REVIEWED_OK", "REVIEWED_REJECTED"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

/** 원문 발췌 금지 — 개념명/함정 유형처럼 짧게 추상화된 서술만 허용한다(길이로 물리적 방어). */
const abstractedShortText = z.string().max(SHORT_ABSTRACTED_TEXT_MAX_LENGTH).nullable();

/**
 * `reference_item_features` 테이블 한 행에 대응하는 입력 shape.
 *
 * 이 스키마는 문항의 원문 전체를 담는 필드를 절대 포함하지 않는다 — 오직 추상화된 특징
 * (개념/추론 패턴/난이도 등)만 다룬다. `primary_concept`/`common_trap_candidate`는
 * 200자 제한으로 원문 발췌 자체를 물리적으로 어렵게 만든다.
 */
export const referenceItemFeatureSchema = z.object({
  referenceDocumentId: z.string().min(1),
  /** 형식: {document_key}#p{페이지3자리}-i{순번2자리} */
  localItemKey: z
    .string()
    .regex(/^.+#p\d{3}-i\d{2}$/, "localItemKey는 {document_key}#p###-i## 형식이어야 합니다."),
  pageNumber: z.number().int().positive(),
  curriculumNodeCodes: z.array(z.string().min(1)),
  primaryConcept: abstractedShortText,
  secondaryConcepts: z.array(z.string().min(1)).nullable(),
  requiredSkills: z.array(z.string().min(1)).nullable(),
  prerequisiteSkills: z.array(z.string().min(1)).nullable(),
  representationType: representationTypeSchema.nullable(),
  answerFormat: z.string().nullable(),
  conditionCount: z.number().int().min(0).nullable(),
  reasoningPattern: z.string().nullable(),
  reasoningStepCount: z.number().int().min(0).nullable(),
  calculationLoad: calculationLoadSchema.nullable(),
  conceptLoad: z.number().int().min(0).nullable(),
  transformationPattern: z.array(z.string().min(1)).nullable(),
  graphOrDiagramRequired: z.boolean(),
  commonTrapCandidate: abstractedShortText,
  approximateDifficulty: referenceDifficultySchema,
  familySignature: z.string().nullable(),
  extractionConfidence: z.number().min(0).max(1).nullable(),
  reviewStatus: reviewStatusSchema,
});
export type ReferenceItemFeatureInput = z.infer<typeof referenceItemFeatureSchema>;
