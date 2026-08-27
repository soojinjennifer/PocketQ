import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createCurriculumRepository, CurriculumRepositoryError } from "./curriculumRepository";
import type { CurriculumNodeInput, CurriculumPrerequisiteInput } from "./curriculumSourceSchema";
import type { ReferenceSourceInput } from "./referenceSourceSchema";

interface ChainStep {
  method: string;
  args: unknown[];
}

interface RecordedCall {
  table: string;
  chain: ChainStep[];
}

/**
 * `from(table).method1(...).method2(...)` 체이닝을 흉내내는 가짜 Supabase 클라이언트.
 * `problemRepository.test.ts`의 fake client 패턴을 재사용하되, upsert().select()/
 * select().in()/update().eq() 같은 다단계 체이닝까지 지원하도록 확장했다.
 * await(= `.then()`) 시점에만 결과를 확정한다(PostgREST 빌더와 동일한 thenable 동작).
 */
function createFakeClient(
  resolveResult: (table: string, chain: ChainStep[]) => { data?: unknown; error?: unknown },
) {
  const calls: RecordedCall[] = [];

  function makeBuilder(table: string, chain: ChainStep[]) {
    function step(method: string) {
      return (...args: unknown[]) => makeBuilder(table, [...chain, { method, args }]);
    }

    return {
      upsert: step("upsert"),
      select: step("select"),
      update: step("update"),
      eq: step("eq"),
      in: step("in"),
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

const REFERENCE_SOURCE: ReferenceSourceInput = {
  name: "테스트 참고자료",
  publisher: null,
  sourceUrl: "https://example.com/source",
  sourceType: "blog_pdf_collection",
  subject: ["ALG", "CALC1"],
  curriculumVersion: "2022",
  licenseType: null,
  licenseUrl: null,
  licenseVerified: false,
  usageMode: "REFERENCE_ONLY",
  attributionText: null,
  retrievedAt: "2026-08-25T00:00:00.000Z",
  notes: null,
};

function buildNode(overrides: Partial<CurriculumNodeInput> & Pick<CurriculumNodeInput, "code" | "nodeType" | "parentCode">): CurriculumNodeInput {
  return {
    subject: "ALG",
    name: `이름-${overrides.code}`,
    description: null,
    curriculumVersion: "2022",
    csatImportance: null,
    difficultyBase: null,
    allowedScope: null,
    forbiddenScope: null,
    isActive: true,
    ...overrides,
  };
}

describe("curriculumRepository", () => {
  describe("saveReferenceSource", () => {
    it("reference_sources 테이블에 onConflict source_url로 upsert한다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createCurriculumRepository(client).saveReferenceSource(REFERENCE_SOURCE);

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        table: "reference_sources",
        chain: [
          {
            method: "upsert",
            args: [
              {
                name: "테스트 참고자료",
                publisher: null,
                source_url: "https://example.com/source",
                source_type: "blog_pdf_collection",
                subject: ["ALG", "CALC1"],
                curriculum_version: "2022",
                license_type: null,
                license_url: null,
                license_verified: false,
                usage_mode: "REFERENCE_ONLY",
                attribution_text: null,
                retrieved_at: "2026-08-25T00:00:00.000Z",
                notes: null,
              },
              { onConflict: "source_url" },
            ],
          },
        ],
      });
    });

    it("Supabase가 error를 반환하면 CurriculumRepositoryError를 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));

      await expect(createCurriculumRepository(client).saveReferenceSource(REFERENCE_SOURCE)).rejects.toBeInstanceOf(
        CurriculumRepositoryError,
      );
    });
  });

  describe("saveCurriculumNodes", () => {
    const nodes: CurriculumNodeInput[] = [
      buildNode({ code: "A", nodeType: "SUBJECT", parentCode: null }),
      buildNode({ code: "B", nodeType: "UNIT", parentCode: "A" }),
      buildNode({ code: "C", nodeType: "SUBUNIT", parentCode: "B" }),
    ];

    it("1차 upsert(parent_id=null) 후 2차 code→id 맵으로 parent_id를 update한다", async () => {
      const { client, calls } = createFakeClient((_table, chain) => {
        const first = chain[0];
        if (first?.method === "upsert") {
          return {
            data: [
              { id: "id-A", code: "A" },
              { id: "id-B", code: "B" },
              { id: "id-C", code: "C" },
            ],
            error: null,
          };
        }
        return { error: null };
      });

      await createCurriculumRepository(client).saveCurriculumNodes(nodes);

      expect(calls).toHaveLength(3);

      // 1차 upsert: 모든 행이 parent_id null로 들어간다.
      expect(calls[0]).toEqual({
        table: "curriculum_nodes",
        chain: [
          {
            method: "upsert",
            args: [
              [
                {
                  code: "A",
                  subject: "ALG",
                  node_type: "SUBJECT",
                  parent_id: null,
                  name: "이름-A",
                  description: null,
                  curriculum_version: "2022",
                  csat_importance: null,
                  difficulty_base: null,
                  allowed_scope: null,
                  forbidden_scope: null,
                  source_id: null,
                  is_active: true,
                },
                {
                  code: "B",
                  subject: "ALG",
                  node_type: "UNIT",
                  parent_id: null,
                  name: "이름-B",
                  description: null,
                  curriculum_version: "2022",
                  csat_importance: null,
                  difficulty_base: null,
                  allowed_scope: null,
                  forbidden_scope: null,
                  source_id: null,
                  is_active: true,
                },
                {
                  code: "C",
                  subject: "ALG",
                  node_type: "SUBUNIT",
                  parent_id: null,
                  name: "이름-C",
                  description: null,
                  curriculum_version: "2022",
                  csat_importance: null,
                  difficulty_base: null,
                  allowed_scope: null,
                  forbidden_scope: null,
                  source_id: null,
                  is_active: true,
                },
              ],
              { onConflict: "code" },
            ],
          },
          { method: "select", args: ["id, code"] },
        ],
      });

      // 2차: parentCode가 있는 노드(B, C)만 순서대로 update한다.
      expect(calls[1]).toEqual({
        table: "curriculum_nodes",
        chain: [
          { method: "update", args: [{ parent_id: "id-A" }] },
          { method: "eq", args: ["code", "B"] },
        ],
      });
      expect(calls[2]).toEqual({
        table: "curriculum_nodes",
        chain: [
          { method: "update", args: [{ parent_id: "id-B" }] },
          { method: "eq", args: ["code", "C"] },
        ],
      });
    });

    it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createCurriculumRepository(client).saveCurriculumNodes([]);

      expect(calls).toHaveLength(0);
    });

    it("1차 upsert 결과에 parentCode의 id가 없으면 던진다", async () => {
      const { client } = createFakeClient((_table, chain) => {
        const first = chain[0];
        if (first?.method === "upsert") {
          return { data: [{ id: "id-A", code: "A" }], error: null }; // B, C 누락
        }
        return { error: null };
      });

      await expect(createCurriculumRepository(client).saveCurriculumNodes(nodes)).rejects.toBeInstanceOf(
        CurriculumRepositoryError,
      );
    });

    it("Supabase가 1차 upsert에서 error를 반환하면 던진다", async () => {
      const { client } = createFakeClient(() => ({ error: { message: "실패" } }));

      await expect(createCurriculumRepository(client).saveCurriculumNodes(nodes)).rejects.toBeInstanceOf(
        CurriculumRepositoryError,
      );
    });
  });

  describe("saveCurriculumPrerequisites", () => {
    const prerequisites: CurriculumPrerequisiteInput[] = [
      { nodeCode: "B", prerequisiteNodeCode: "A", strength: "required", notes: "필수 선수개념" },
    ];

    it("code→id 조회 후 upsert(node_id,prerequisite_node_id)로 저장한다", async () => {
      const { client, calls } = createFakeClient((_table, chain) => {
        const first = chain[0];
        if (first?.method === "select") {
          return {
            data: [
              { id: "id-A", code: "A" },
              { id: "id-B", code: "B" },
            ],
            error: null,
          };
        }
        return { error: null };
      });

      await createCurriculumRepository(client).saveCurriculumPrerequisites(prerequisites);

      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual({
        table: "curriculum_nodes",
        chain: [
          { method: "select", args: ["id, code"] },
          { method: "in", args: ["code", ["B", "A"]] },
        ],
      });
      expect(calls[1]).toEqual({
        table: "curriculum_prerequisites",
        chain: [
          {
            method: "upsert",
            args: [
              [
                {
                  node_id: "id-B",
                  prerequisite_node_id: "id-A",
                  strength: "required",
                  notes: "필수 선수개념",
                },
              ],
              { onConflict: "node_id,prerequisite_node_id" },
            ],
          },
        ],
      });
    });

    it("빈 배열이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient(() => ({ error: null }));

      await createCurriculumRepository(client).saveCurriculumPrerequisites([]);

      expect(calls).toHaveLength(0);
    });

    it("조회 결과에 코드의 id가 없으면 던진다", async () => {
      const { client } = createFakeClient((_table, chain) => {
        const first = chain[0];
        if (first?.method === "select") {
          return { data: [{ id: "id-A", code: "A" }], error: null }; // B 누락
        }
        return { error: null };
      });

      await expect(
        createCurriculumRepository(client).saveCurriculumPrerequisites(prerequisites),
      ).rejects.toBeInstanceOf(CurriculumRepositoryError);
    });
  });
});
