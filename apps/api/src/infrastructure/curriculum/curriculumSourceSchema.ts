import { z } from "zod";

/**
 * 교육과정 트리 노드 타입. 계층 순서는 항상
 * SUBJECT > UNIT > SUBUNIT > CONCEPT > SKILL 이며, 부모는 자식보다 정확히
 * 한 단계 위 타입이어야 한다(validateCurriculumGraph에서 검사).
 */
export const curriculumNodeTypeSchema = z.enum(["SUBJECT", "UNIT", "SUBUNIT", "CONCEPT", "SKILL"]);
export type CurriculumNodeType = z.infer<typeof curriculumNodeTypeSchema>;

/** 선수관계 강도. Stage 1 결정사항(C): 3단계 텍스트로 고정. */
export const curriculumPrerequisiteStrengthSchema = z.enum(["required", "recommended", "optional"]);
export type CurriculumPrerequisiteStrength = z.infer<typeof curriculumPrerequisiteStrengthSchema>;

/** `curriculum_nodes` 테이블 한 행에 대응하는 JSON 소스 노드 shape. */
export const curriculumNodeSchema = z.object({
  code: z.string().min(1),
  nodeType: curriculumNodeTypeSchema,
  /** SUBJECT 노드만 null이 허용된다(트리 루트). */
  parentCode: z.string().min(1).nullable(),
  subject: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  curriculumVersion: z.string().min(1),
  /** 1~5 정수 스케일(임시, 결정사항 B). Stage 1 콘텐츠는 대부분 null. */
  csatImportance: z.number().int().min(1).max(5).nullable(),
  /**
   * `csatImportance` 값을 어떤 근거로 정했는지 짧게 서술한 옵셔널 필드(Stage 3.5 결정사항).
   * 기존 노드(대부분 csatImportance가 null인 노드 포함)는 이 필드 자체가 없어도 되므로
   * 하위 호환에 영향이 없다 — 값을 채운 노드에만 함께 기록한다.
   */
  csatImportanceRationale: z.string().min(1).max(300).optional(),
  difficultyBase: z.number().int().min(1).max(5).nullable(),
  allowedScope: z.string().nullable(),
  forbiddenScope: z.string().nullable(),
  isActive: z.boolean(),
});
export type CurriculumNodeInput = z.infer<typeof curriculumNodeSchema>;

/** `curriculum_prerequisites` 테이블 한 행에 대응하는 JSON 소스 선수관계 shape. */
export const curriculumPrerequisiteSchema = z.object({
  nodeCode: z.string().min(1),
  prerequisiteNodeCode: z.string().min(1),
  strength: curriculumPrerequisiteStrengthSchema,
  notes: z.string().nullable(),
});
export type CurriculumPrerequisiteInput = z.infer<typeof curriculumPrerequisiteSchema>;

/**
 * `data/math-curriculum/*.v1.json` 파일 하나(과목 하나) 전체의 shape.
 * `sourceId`는 Stage 1에서 전부 null이다(결정사항 D: 교육과정 트리 자체는
 * 특정 참고자료 고유 콘텐츠가 아니므로).
 */
export const curriculumSourceSchema = z.object({
  subject: z.string().min(1),
  curriculumVersion: z.string().min(1),
  sourceId: z.string().nullable(),
  nodes: z.array(curriculumNodeSchema).min(1),
  prerequisites: z.array(curriculumPrerequisiteSchema),
});
export type CurriculumSource = z.infer<typeof curriculumSourceSchema>;
