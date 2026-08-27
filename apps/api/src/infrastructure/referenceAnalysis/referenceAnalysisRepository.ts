import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "../supabase/client";
import type { ProblemFamilyCandidateInput } from "./problemFamilyCandidateSchema";
import type { ReferenceDocumentInput } from "./referenceDocumentSchema";
import type { ReferenceItemFeatureInput } from "./referenceItemFeatureSchema";

/**
 * Problem DB Stage 2 전용 리포지토리("참고자료 파일럿 분석 → 문제 패밀리 후보" 데이터).
 *
 * `curriculumRepository.ts`와 동일하게 팩토리(`createReferenceAnalysisRepository`) +
 * 지연초기화 싱글턴(`referenceAnalysisRepository`) 패턴을 따른다. 오너가 직접 실행하는
 * 관리용 CLI(`reference:extract-pilot`)에서만 쓰이며, 실패 시 조용히 삼키지 않고 그대로
 * throw한다(curriculumRepository와 동일 원칙 — 부분 실패가 조용히 넘어가면 안 됨).
 *
 * `delete` 문은 어디에도 없다.
 */
/** `problem_family_candidates` 한 행 전체(Stage 3가 읽기 전용으로 재사용). */
export interface ProblemFamilyCandidateRow extends ProblemFamilyCandidateInput {
  id: string;
}

export interface ReferenceAnalysisRepository {
  /** Stage 1 `reference_sources.source_url`로 기존 참고자료의 id를 조회한다(읽기 전용). */
  resolveReferenceSourceIdByUrl(sourceUrl: string): Promise<string>;
  saveReferenceDocument(input: ReferenceDocumentInput): Promise<string>;
  saveReferenceItemFeatures(inputs: ReferenceItemFeatureInput[]): Promise<void>;
  saveProblemFamilyCandidates(inputs: ProblemFamilyCandidateInput[]): Promise<void>;
  /**
   * `problem_family_candidates` 전체를 읽기 전용으로 조회한다(Stage 3 calibration
   * 파이프라인이 Stage 2가 저장한 family 후보를 다시 읽어 증거 매칭/승인 평가에 쓰는 용도).
   * 이 메서드는 어떤 행도 수정하지 않는다.
   */
  listProblemFamilyCandidates(): Promise<ProblemFamilyCandidateRow[]>;
}

export class ReferenceAnalysisRepositoryError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`[referenceAnalysisRepository] ${operation} 실패: ${String(cause)}`);
    this.name = "ReferenceAnalysisRepositoryError";
  }
}

function throwIfError(operation: string, error: unknown): void {
  if (error) {
    throw new ReferenceAnalysisRepositoryError(operation, error);
  }
}

interface DocumentIdRow {
  id: string;
}

/** `problem_family_candidates` 테이블 select 결과 행(snake_case, DB 그대로). */
interface ProblemFamilyCandidateDbRow {
  id: string;
  candidate_code: string;
  subject: string;
  unit: string | null;
  curriculum_node_codes: string[] | null;
  family_name: string;
  core_concept: string;
  required_skills: string[] | null;
  reasoning_signature: string;
  canonical_reasoning_steps: string[] | null;
  representation_types: string[] | null;
  prerequisite_nodes: string[] | null;
  approximate_difficulty_min: ProblemFamilyCandidateInput["approximateDifficultyMin"];
  approximate_difficulty_max: ProblemFamilyCandidateInput["approximateDifficultyMax"];
  source_item_count: number;
  evidence_item_keys: string[] | null;
  confidence: number | null;
  status: ProblemFamilyCandidateInput["status"];
}

export function createReferenceAnalysisRepository(client: SupabaseClient): ReferenceAnalysisRepository {
  return {
    async resolveReferenceSourceIdByUrl(sourceUrl) {
      const result = (await client
        .from("reference_sources")
        .select("id")
        .eq("source_url", sourceUrl)) as { data: DocumentIdRow[] | null; error: unknown };
      throwIfError("resolveReferenceSourceIdByUrl", result.error);

      const id = result.data?.[0]?.id;
      if (!id) {
        throw new ReferenceAnalysisRepositoryError(
          "resolveReferenceSourceIdByUrl",
          `source_url=${sourceUrl}에 해당하는 reference_sources 행을 찾을 수 없습니다(Stage 1 임포트가 선행되어야 합니다).`,
        );
      }
      return id;
    },

    async saveReferenceDocument(input) {
      const result = (await client
        .from("reference_documents")
        .upsert(
          {
            source_id: input.sourceId,
            document_key: input.documentKey,
            filename: input.filename,
            subject: input.subject,
            unit: input.unit,
            curriculum_version: input.curriculumVersion,
            file_hash: input.fileHash,
            page_count: input.pageCount,
            extraction_version: input.extractionVersion,
            parser_version: input.parserVersion,
            usage_mode: input.usageMode,
            license_status: input.licenseStatus,
            processed_at: input.processedAt,
          },
          { onConflict: "document_key" },
        )
        .select("id")) as { data: DocumentIdRow[] | null; error: unknown };
      throwIfError("saveReferenceDocument", result.error);

      const id = result.data?.[0]?.id;
      if (!id) {
        throw new ReferenceAnalysisRepositoryError(
          "saveReferenceDocument",
          `upsert 결과에서 id를 찾을 수 없습니다(document_key=${input.documentKey})`,
        );
      }
      return id;
    },

    async saveReferenceItemFeatures(inputs) {
      if (inputs.length === 0) return;

      const rows = inputs.map((input) => ({
        reference_document_id: input.referenceDocumentId,
        local_item_key: input.localItemKey,
        page_number: input.pageNumber,
        curriculum_node_codes: input.curriculumNodeCodes,
        primary_concept: input.primaryConcept,
        secondary_concepts: input.secondaryConcepts,
        required_skills: input.requiredSkills,
        prerequisite_skills: input.prerequisiteSkills,
        representation_type: input.representationType,
        answer_format: input.answerFormat,
        condition_count: input.conditionCount,
        reasoning_pattern: input.reasoningPattern,
        reasoning_step_count: input.reasoningStepCount,
        calculation_load: input.calculationLoad,
        concept_load: input.conceptLoad,
        transformation_pattern: input.transformationPattern,
        graph_or_diagram_required: input.graphOrDiagramRequired,
        common_trap_candidate: input.commonTrapCandidate,
        approximate_difficulty: input.approximateDifficulty,
        family_signature: input.familySignature,
        extraction_confidence: input.extractionConfidence,
        review_status: input.reviewStatus,
      }));

      const { error } = await client
        .from("reference_item_features")
        .upsert(rows, { onConflict: "reference_document_id,local_item_key" });
      throwIfError("saveReferenceItemFeatures", error);
    },

    async saveProblemFamilyCandidates(inputs) {
      if (inputs.length === 0) return;

      const rows = inputs.map((input) => ({
        candidate_code: input.candidateCode,
        subject: input.subject,
        unit: input.unit,
        curriculum_node_codes: input.curriculumNodeCodes,
        family_name: input.familyName,
        core_concept: input.coreConcept,
        required_skills: input.requiredSkills,
        reasoning_signature: input.reasoningSignature,
        canonical_reasoning_steps: input.canonicalReasoningSteps,
        representation_types: input.representationTypes,
        prerequisite_nodes: input.prerequisiteNodes,
        approximate_difficulty_min: input.approximateDifficultyMin,
        approximate_difficulty_max: input.approximateDifficultyMax,
        source_item_count: input.sourceItemCount,
        evidence_item_keys: input.evidenceItemKeys,
        confidence: input.confidence,
        status: input.status,
      }));

      const { error } = await client
        .from("problem_family_candidates")
        .upsert(rows, { onConflict: "candidate_code" });
      throwIfError("saveProblemFamilyCandidates", error);
    },

    async listProblemFamilyCandidates() {
      const result = (await client.from("problem_family_candidates").select("*")) as {
        data: ProblemFamilyCandidateDbRow[] | null;
        error: unknown;
      };
      throwIfError("listProblemFamilyCandidates", result.error);

      return (result.data ?? []).map((row) => ({
        id: row.id,
        candidateCode: row.candidate_code,
        subject: row.subject,
        unit: row.unit,
        curriculumNodeCodes: row.curriculum_node_codes,
        familyName: row.family_name,
        coreConcept: row.core_concept,
        requiredSkills: row.required_skills,
        reasoningSignature: row.reasoning_signature,
        canonicalReasoningSteps: row.canonical_reasoning_steps,
        representationTypes: row.representation_types,
        prerequisiteNodes: row.prerequisite_nodes,
        approximateDifficultyMin: row.approximate_difficulty_min,
        approximateDifficultyMax: row.approximate_difficulty_max,
        sourceItemCount: row.source_item_count,
        evidenceItemKeys: row.evidence_item_keys,
        confidence: row.confidence,
        status: row.status,
      }));
    },
  };
}

/**
 * 운영용 기본 인스턴스. CLI 스크립트가 직접 import해서 쓴다(curriculumRepository와 동일 패턴).
 * Supabase 클라이언트는 모듈 로드 시점이 아니라 첫 호출 시점에 만든다.
 */
let defaultRepository: ReferenceAnalysisRepository | undefined;

function getDefaultRepository(): ReferenceAnalysisRepository {
  defaultRepository ??= createReferenceAnalysisRepository(getSupabaseServerClient());
  return defaultRepository;
}

export const referenceAnalysisRepository: ReferenceAnalysisRepository = {
  async resolveReferenceSourceIdByUrl(sourceUrl) {
    return getDefaultRepository().resolveReferenceSourceIdByUrl(sourceUrl);
  },
  async saveReferenceDocument(input) {
    return getDefaultRepository().saveReferenceDocument(input);
  },
  async saveReferenceItemFeatures(inputs) {
    await getDefaultRepository().saveReferenceItemFeatures(inputs);
  },
  async saveProblemFamilyCandidates(inputs) {
    await getDefaultRepository().saveProblemFamilyCandidates(inputs);
  },
  async listProblemFamilyCandidates() {
    return getDefaultRepository().listProblemFamilyCandidates();
  },
};
