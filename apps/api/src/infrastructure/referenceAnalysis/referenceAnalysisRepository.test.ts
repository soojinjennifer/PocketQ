import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ProblemFamilyCandidateInput } from "./problemFamilyCandidateSchema";
import {
  createReferenceAnalysisRepository,
  ReferenceAnalysisRepositoryError,
} from "./referenceAnalysisRepository";
import type { ReferenceDocumentInput } from "./referenceDocumentSchema";
import type { ReferenceItemFeatureInput } from "./referenceItemFeatureSchema";

interface ChainStep {
  method: string;
  args: unknown[];
}

interface RecordedCall {
  table: string;
  chain: ChainStep[];
}

/** `curriculumRepository.test.ts`의 가짜 Supabase 클라이언트 패턴을 그대로 재사용한다. */
function createFakeClient(resolveResult: (table: string, chain: ChainStep[]) => { data?: unknown; error?: unknown }) {
  const calls: RecordedCall[] = [];

  function makeBuilder(table: string, chain: ChainStep[]) {
    function step(method: string) {
      return (...args: unknown[]) => makeBuilder(table, [...chain, { method, args }]);
    }

    return {
      upsert: step("upsert"),
      select: step("select"),
      eq: step("eq"),
      then: (
        onFulfilled: (value: { data?: unknown; error?: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        calls.push({ table, chain });
        return Promise.resolve(resolveResult(table, chain)).then(onFulfilled, onRejected);
      },
    };
  }

  const client = { from: (table: string) => makeBuilder(table, []) };
  return { client: client as unknown as SupabaseClient, calls };
}

const DOCUMENT: ReferenceDocumentInput = {
  sourceId: "source-1",
  documentKey: "mathjk-alg-explog-01",
  filename: "테스트.pdf",
  subject: "ALG",
  unit: "지수함수와 로그함수",
  curriculumVersion: "2022",
  fileHash: "a".repeat(64),
  pageCount: 10,
  extractionVersion: "stage2-v1",
  parserVersion: "pdfjs-dist@6.2.108",
  usageMode: "REFERENCE_ONLY",
  licenseStatus: "UNVERIFIED",
  processedAt: "2026-08-26T00:00:00.000Z",
};

const ITEM_FEATURE: ReferenceItemFeatureInput = {
  referenceDocumentId: "doc-1",
  localItemKey: "mathjk-alg-explog-01#p002-i01",
  pageNumber: 2,
  curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
  primaryConcept: "합성 개념 설명",
  secondaryConcepts: null,
  requiredSkills: ["skill-a"],
  prerequisiteSkills: null,
  representationType: "equation",
  answerFormat: "multiple_choice_5",
  conditionCount: 2,
  reasoningPattern: "case_split_then_sum",
  reasoningStepCount: 3,
  calculationLoad: "MEDIUM",
  conceptLoad: 2,
  transformationPattern: ["sign-analysis"],
  graphOrDiagramRequired: false,
  commonTrapCandidate: "함정 설명",
  approximateDifficulty: "D2",
  familySignature: "sig-1",
  extractionConfidence: 0.85,
  reviewStatus: "NEEDS_REVIEW",
};

const FAMILY_CANDIDATE: ProblemFamilyCandidateInput = {
  candidateCode: "FAM-ALG-EXPLOG-001",
  subject: "ALG",
  unit: "지수함수와 로그함수",
  curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
  familyName: "합성 패밀리",
  coreConcept: "합성 개념",
  requiredSkills: ["skill-a"],
  reasoningSignature: "sig-1",
  canonicalReasoningSteps: ["단계 1", "단계 2"],
  representationTypes: ["equation"],
  prerequisiteNodes: null,
  approximateDifficultyMin: "D1",
  approximateDifficultyMax: "D3",
  sourceItemCount: 2,
  evidenceItemKeys: ["mathjk-alg-explog-01#p002-i01", "mathjk-alg-explog-01#p003-i01"],
  confidence: 0.7,
  status: "CANDIDATE",
};

describe("referenceAnalysisRepository", () => {
  describe("resolveReferenceSourceIdByUrl", () => {
    it("reference_sources를 source_url로 조회해 id를 반환한다", async () => {
      const { client, calls } = createFakeClient(() => ({ data: [{ id: "source-1" }], error: null }));

      const id = await createReferenceAnalysisRepository(client).resolveReferenceSourceIdByUrl(
        "https://mathjk.tistory.com/3584",
      );

      expect(id).toBe("source-1");
      expect(calls[0]).toEqual({
        table: "reference_sources",
        chain: [
          { method: "select", args: ["id"] },
          { method: "eq", args: ["source_url", "https://mathjk.tistory.com/3584"] },
        ],
      });
    });

    it("행을 찾을 수 없으면 던진다", async () => {
      const { client } = createFakeClient(() => ({ data: [], error: null }));

      await expect(
        createReferenceAnalysisRepository(client).resolveReferenceSourceIdByUrl("https://unknown.example.com"),
      ).rejects.toBeInstanceOf(ReferenceAnalysisRepositoryError);
    });
  });

  describe("saveReferenceDocument", () => {
    it("reference_documents 테이블에 onConflict document_key로 upsert하고 id를 반환한다", async () => {
      const { client, calls } = createFakeClient(() => ({ data: [{ id: "doc-1" }], error: null }));

      const id = await createReferenceAnalysisRepository(client).saveReferenceDocument(DOCUMENT);

      expect(id).toBe("doc-1");
      expect(calls).toHaveLength(1);
      expect(calls[0]!.table).toBe("reference_documents");
      expect(calls[0]!.chain[0]).toEqual({
        method: "upsert",
        args: [
          {
            source_id: "source-1",
            document_key: "mathjk-alg-explog-01",
            filename: "테스트.pdf",
            subject: "ALG",
            unit: "지수함수와 로그함수",
            curriculum_version: "2022",
            file_hash: "a".repeat(64),
            page_count: 10,
            extraction_version: "stage2-v1",
            parser_version: "pdfjs-dist@6.2.108",
            usage_mode: "REFERENCE_ONLY",
            license_status: "UNVERIFIED",
            processed_at: "2026-08-26T00:00:00.000Z",
          },
          { onConflict: "document_key" },
        ],
      });
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));

      await expect(createReferenceAnalysisRepository(client).saveReferenceDocument(DOCUMENT)).rejects.toBeInstanceOf(
        ReferenceAnalysisRepositoryError,
      );
    });

    it("upsert 결과에 id가 없으면 던진다", async () => {
      const { client } = createFakeClient(() => ({ data: [], error: null }));

      await expect(createReferenceAnalysisRepository(client).saveReferenceDocument(DOCUMENT)).rejects.toBeInstanceOf(
        ReferenceAnalysisRepositoryError,
      );
    });
  });

  describe("saveReferenceItemFeatures", () => {
    it("reference_item_features 테이블에 onConflict (reference_document_id,local_item_key)로 upsert한다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createReferenceAnalysisRepository(client).saveReferenceItemFeatures([ITEM_FEATURE]);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.table).toBe("reference_item_features");
      expect(calls[0]!.chain[0]!.args[1]).toEqual({ onConflict: "reference_document_id,local_item_key" });
      const rows = calls[0]!.chain[0]!.args[0] as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        reference_document_id: "doc-1",
        local_item_key: "mathjk-alg-explog-01#p002-i01",
        approximate_difficulty: "D2",
        review_status: "NEEDS_REVIEW",
      });
    });

    it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));
      await createReferenceAnalysisRepository(client).saveReferenceItemFeatures([]);
      expect(calls).toHaveLength(0);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createReferenceAnalysisRepository(client).saveReferenceItemFeatures([ITEM_FEATURE]),
      ).rejects.toBeInstanceOf(ReferenceAnalysisRepositoryError);
    });
  });

  describe("saveProblemFamilyCandidates", () => {
    it("problem_family_candidates 테이블에 onConflict candidate_code로 upsert한다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createReferenceAnalysisRepository(client).saveProblemFamilyCandidates([FAMILY_CANDIDATE]);

      expect(calls).toHaveLength(1);
      expect(calls[0]!.table).toBe("problem_family_candidates");
      expect(calls[0]!.chain[0]!.args[1]).toEqual({ onConflict: "candidate_code" });
      const rows = calls[0]!.chain[0]!.args[0] as Array<Record<string, unknown>>;
      expect(rows[0]).toMatchObject({ candidate_code: "FAM-ALG-EXPLOG-001", status: "CANDIDATE" });
    });

    it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));
      await createReferenceAnalysisRepository(client).saveProblemFamilyCandidates([]);
      expect(calls).toHaveLength(0);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createReferenceAnalysisRepository(client).saveProblemFamilyCandidates([FAMILY_CANDIDATE]),
      ).rejects.toBeInstanceOf(ReferenceAnalysisRepositoryError);
    });
  });

  describe("listProblemFamilyCandidates", () => {
    it("problem_family_candidates 전체를 읽어 camelCase 입력 shape + id로 변환한다(읽기 전용)", async () => {
      const dbRow = {
        id: "family-1",
        candidate_code: "FAM-ALG-EXPLOG-001",
        subject: "ALG",
        unit: "지수함수와 로그함수",
        curriculum_node_codes: ["ALG_EXP_LOG_EXP"],
        family_name: "합성 패밀리",
        core_concept: "합성 개념",
        required_skills: ["skill-a"],
        reasoning_signature: "sig-1",
        canonical_reasoning_steps: ["단계 1", "단계 2"],
        representation_types: ["equation"],
        prerequisite_nodes: null,
        approximate_difficulty_min: "D1",
        approximate_difficulty_max: "D3",
        source_item_count: 2,
        evidence_item_keys: ["mathjk-alg-explog-01#p002-i01", "mathjk-alg-explog-01#p003-i01"],
        confidence: 0.7,
        status: "CANDIDATE",
      };
      const { client, calls } = createFakeClient(() => ({ data: [dbRow], error: null }));

      const rows = await createReferenceAnalysisRepository(client).listProblemFamilyCandidates();

      expect(calls[0]).toEqual({ table: "problem_family_candidates", chain: [{ method: "select", args: ["*"] }] });
      expect(rows).toEqual([{ id: "family-1", ...FAMILY_CANDIDATE }]);
    });

    it("행이 없으면 빈 배열을 돌려준다", async () => {
      const { client } = createFakeClient(() => ({ data: [], error: null }));
      expect(await createReferenceAnalysisRepository(client).listProblemFamilyCandidates()).toEqual([]);
    });

    it("Supabase가 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));
      await expect(
        createReferenceAnalysisRepository(client).listProblemFamilyCandidates(),
      ).rejects.toBeInstanceOf(ReferenceAnalysisRepositoryError);
    });
  });
});
