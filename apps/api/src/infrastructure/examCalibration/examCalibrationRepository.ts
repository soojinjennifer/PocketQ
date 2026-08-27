import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "../supabase/client";
import type { ExamItemFeatureInput } from "./examItemFeatureSchema";
import type { EvidenceTier } from "./examReferenceSetSchema";
import type { ExamReferenceSetInput } from "./examReferenceSetSchema";
import type { ProblemFamilyCalibrationInput } from "./problemFamilyCalibrationSchema";
import type { ProblemFamilyEvidenceInput } from "./problemFamilyEvidenceSchema";

/**
 * Problem DB Stage 3 전용 리포지토리("CSAT Gold-Set Calibration & Family Approval" 데이터).
 *
 * Stage 1/2와 동일하게 팩토리(`createExamCalibrationRepository`) + 지연초기화 싱글턴
 * (`examCalibrationRepository`) 패턴을 따른다. 오너가 직접 실행하는 관리용 CLI에서만 쓰이며,
 * 실패 시 조용히 삼키지 않고 그대로 throw한다. `delete` 문은 어디에도 없다.
 */
export interface ExamItemFeatureIdRow {
  itemNumber: number;
  id: string;
}

/** `listExamItemFeaturesByExamReferenceSetId` 결과 행(evidence 매칭에 필요한 필드만). */
export interface ExamItemFeatureForMatching {
  id: string;
  itemNumber: number;
  subjectMapping: string;
  curriculumNodeCodes: string[];
  requiredSkills: string[] | null;
  reasoningSignature: string | null;
  representationType: string | null;
  curriculumCompatibility: string | null;
  conceptLoad: number | null;
  reasoningStepCount: number | null;
  conditionInterpretationLoad: string | null;
  calculationLoad: string | null;
  caseSplitRequired: boolean;
  representationConversion: boolean;
  nonObviousTransformation: boolean;
}

export interface ExamCalibrationRepository {
  saveExamReferenceSet(input: ExamReferenceSetInput): Promise<string>;
  saveExamItemFeatures(inputs: ExamItemFeatureInput[]): Promise<ExamItemFeatureIdRow[]>;
  saveProblemFamilyEvidence(inputs: ProblemFamilyEvidenceInput[]): Promise<void>;
  saveProblemFamilyCalibration(inputs: ProblemFamilyCalibrationInput[]): Promise<void>;
  /** `--apply` 모드에서 이미 존재하는 exam_reference_sets 행을 찾는다(읽기 전용). 없으면 null. */
  findExamReferenceSetIdByCode(examCode: string): Promise<string | null>;
  /** `--apply` 모드에서 exam_reference_set 하나에 속한 exam_item_features 전체를 읽는다(읽기 전용). */
  listExamItemFeaturesByExamReferenceSetId(examReferenceSetId: string): Promise<ExamItemFeatureForMatching[]>;
  /** `--apply` 모드에서 SILVER_KICE 등급 exam_reference_sets가 1건이라도 있는지 확인한다(읽기 전용). */
  hasAnyExamReferenceSetWithEvidenceTier(evidenceTier: EvidenceTier): Promise<boolean>;
}

export class ExamCalibrationRepositoryError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`[examCalibrationRepository] ${operation} 실패: ${String(cause)}`);
    this.name = "ExamCalibrationRepositoryError";
  }
}

function throwIfError(operation: string, error: unknown): void {
  if (error) {
    throw new ExamCalibrationRepositoryError(operation, error);
  }
}

interface IdRow {
  id: string;
}

/** `exam_item_features` 테이블 select 결과 행(snake_case, DB 그대로, 필요한 컬럼만). */
interface ExamItemFeatureDbRow {
  id: string;
  item_number: number;
  subject_mapping: string;
  curriculum_node_codes: string[];
  required_skills: string[] | null;
  reasoning_signature: string | null;
  representation_type: string | null;
  curriculum_compatibility: string | null;
  concept_load: number | null;
  reasoning_step_count: number | null;
  condition_interpretation_load: string | null;
  calculation_load: string | null;
  case_split_required: boolean;
  representation_conversion: boolean;
  non_obvious_transformation: boolean;
}

interface ItemFeatureIdRow {
  id: string;
  item_number: number;
}

export function createExamCalibrationRepository(client: SupabaseClient): ExamCalibrationRepository {
  return {
    async saveExamReferenceSet(input) {
      const result = (await client
        .from("exam_reference_sets")
        .upsert(
          {
            source_id: input.sourceId,
            exam_code: input.examCode,
            exam_type: input.examType,
            exam_year: input.examYear,
            curriculum_version: input.curriculumVersion,
            authority: input.authority,
            evidence_tier: input.evidenceTier,
            license_status: input.licenseStatus,
            usage_mode: input.usageMode,
            document_key: input.documentKey,
            filename: input.filename,
            file_hash: input.fileHash,
            page_count: input.pageCount,
            extraction_version: input.extractionVersion,
            parser_version: input.parserVersion,
            processed_at: input.processedAt,
            is_active: input.isActive,
          },
          { onConflict: "exam_code" },
        )
        .select("id")) as { data: IdRow[] | null; error: unknown };
      throwIfError("saveExamReferenceSet", result.error);

      const id = result.data?.[0]?.id;
      if (!id) {
        throw new ExamCalibrationRepositoryError(
          "saveExamReferenceSet",
          `upsert 결과에서 id를 찾을 수 없습니다(exam_code=${input.examCode})`,
        );
      }
      return id;
    },

    async saveExamItemFeatures(inputs) {
      if (inputs.length === 0) return [];

      const rows = inputs.map((input) => ({
        exam_reference_set_id: input.examReferenceSetId,
        item_number: input.itemNumber,
        subject_mapping: input.subjectMapping,
        curriculum_node_codes: input.curriculumNodeCodes,
        primary_concept: input.primaryConcept,
        secondary_concepts: input.secondaryConcepts,
        required_skills: input.requiredSkills,
        prerequisite_skills: input.prerequisiteSkills,
        representation_type: input.representationType,
        reasoning_signature: input.reasoningSignature,
        reasoning_step_count: input.reasoningStepCount,
        calculation_load: input.calculationLoad,
        concept_load: input.conceptLoad,
        condition_interpretation_load: input.conditionInterpretationLoad,
        case_split_required: input.caseSplitRequired,
        representation_conversion: input.representationConversion,
        non_obvious_transformation: input.nonObviousTransformation,
        answer_format: input.answerFormat,
        official_point_value: input.officialPointValue,
        curriculum_compatibility: input.curriculumCompatibility,
        extraction_confidence: input.extractionConfidence,
        review_status: input.reviewStatus,
      }));

      const result = (await client
        .from("exam_item_features")
        .upsert(rows, { onConflict: "exam_reference_set_id,item_number" })
        .select("id, item_number")) as { data: ItemFeatureIdRow[] | null; error: unknown };
      throwIfError("saveExamItemFeatures", result.error);

      return (result.data ?? []).map((row) => ({ itemNumber: row.item_number, id: row.id }));
    },

    async saveProblemFamilyEvidence(inputs) {
      // 결정사항: match_type='NONE'인 evidence는 저장하지 않는다(비-증거를 증거 테이블에
      // 넣지 않음). 호출부가 이미 필터링했어야 하지만 방어적으로 한 번 더 걸러낸다.
      const rows = inputs
        .filter((input) => input.matchType !== "NONE")
        .map((input) => ({
          family_id: input.familyId,
          exam_item_id: input.examItemId,
          match_type: input.matchType,
          structural_similarity: input.structuralSimilarity,
          skill_overlap: input.skillOverlap,
          reasoning_overlap: input.reasoningOverlap,
          curriculum_compatibility: input.curriculumCompatibility,
          evidence_weight: input.evidenceWeight,
          notes: input.notes,
        }));
      if (rows.length === 0) return;

      const { error } = await client
        .from("problem_family_evidence")
        .upsert(rows, { onConflict: "family_id,exam_item_id" });
      throwIfError("saveProblemFamilyEvidence", error);
    },

    async saveProblemFamilyCalibration(inputs) {
      if (inputs.length === 0) return;

      const rows = inputs.map((input) => ({
        family_id: input.familyId,
        csat_relevance_score: input.csatRelevanceScore,
        csat_relevance_level: input.csatRelevanceLevel,
        difficulty_center: input.difficultyCenter,
        difficulty_min: input.difficultyMin,
        difficulty_max: input.difficultyMax,
        gold_evidence_count: input.goldEvidenceCount,
        silver_evidence_count: input.silverEvidenceCount,
        coverage_confidence: input.coverageConfidence,
        calibration_version: input.calibrationVersion,
        calibrated_at: input.calibratedAt,
        status: input.status,
      }));

      const { error } = await client.from("problem_family_calibration").upsert(rows, { onConflict: "family_id" });
      throwIfError("saveProblemFamilyCalibration", error);
    },

    async findExamReferenceSetIdByCode(examCode) {
      const result = (await client
        .from("exam_reference_sets")
        .select("id")
        .eq("exam_code", examCode)) as { data: IdRow[] | null; error: unknown };
      throwIfError("findExamReferenceSetIdByCode", result.error);
      return result.data?.[0]?.id ?? null;
    },

    async listExamItemFeaturesByExamReferenceSetId(examReferenceSetId) {
      const result = (await client
        .from("exam_item_features")
        .select("*")
        .eq("exam_reference_set_id", examReferenceSetId)) as { data: ExamItemFeatureDbRow[] | null; error: unknown };
      throwIfError("listExamItemFeaturesByExamReferenceSetId", result.error);

      return (result.data ?? []).map((row) => ({
        id: row.id,
        itemNumber: row.item_number,
        subjectMapping: row.subject_mapping,
        curriculumNodeCodes: row.curriculum_node_codes,
        requiredSkills: row.required_skills,
        reasoningSignature: row.reasoning_signature,
        representationType: row.representation_type,
        curriculumCompatibility: row.curriculum_compatibility,
        conceptLoad: row.concept_load,
        reasoningStepCount: row.reasoning_step_count,
        conditionInterpretationLoad: row.condition_interpretation_load,
        calculationLoad: row.calculation_load,
        caseSplitRequired: row.case_split_required,
        representationConversion: row.representation_conversion,
        nonObviousTransformation: row.non_obvious_transformation,
      }));
    },

    async hasAnyExamReferenceSetWithEvidenceTier(evidenceTier) {
      const result = (await client
        .from("exam_reference_sets")
        .select("id")
        .eq("evidence_tier", evidenceTier)) as { data: IdRow[] | null; error: unknown };
      throwIfError("hasAnyExamReferenceSetWithEvidenceTier", result.error);
      return (result.data ?? []).length > 0;
    },
  };
}

/**
 * 운영용 기본 인스턴스. CLI 스크립트가 직접 import해서 쓴다(Stage 1/2와 동일 패턴).
 * Supabase 클라이언트는 모듈 로드 시점이 아니라 첫 호출 시점에 만든다.
 */
let defaultRepository: ExamCalibrationRepository | undefined;

function getDefaultRepository(): ExamCalibrationRepository {
  defaultRepository ??= createExamCalibrationRepository(getSupabaseServerClient());
  return defaultRepository;
}

export const examCalibrationRepository: ExamCalibrationRepository = {
  async saveExamReferenceSet(input) {
    return getDefaultRepository().saveExamReferenceSet(input);
  },
  async saveExamItemFeatures(inputs) {
    return getDefaultRepository().saveExamItemFeatures(inputs);
  },
  async saveProblemFamilyEvidence(inputs) {
    await getDefaultRepository().saveProblemFamilyEvidence(inputs);
  },
  async saveProblemFamilyCalibration(inputs) {
    await getDefaultRepository().saveProblemFamilyCalibration(inputs);
  },
  async findExamReferenceSetIdByCode(examCode) {
    return getDefaultRepository().findExamReferenceSetIdByCode(examCode);
  },
  async listExamItemFeaturesByExamReferenceSetId(examReferenceSetId) {
    return getDefaultRepository().listExamItemFeaturesByExamReferenceSetId(examReferenceSetId);
  },
  async hasAnyExamReferenceSetWithEvidenceTier(evidenceTier) {
    return getDefaultRepository().hasAnyExamReferenceSetWithEvidenceTier(evidenceTier);
  },
};
