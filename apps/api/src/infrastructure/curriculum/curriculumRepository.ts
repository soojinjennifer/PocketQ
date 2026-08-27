import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "../supabase/client";
import type { CurriculumNodeInput, CurriculumPrerequisiteInput } from "./curriculumSourceSchema";
import type { ReferenceSourceInput } from "./referenceSourceSchema";

/**
 * Problem DB Stage 1 전용 리포지토리("참고자료 → 교육과정 지도" 데이터).
 *
 * `problemRepository.ts`와 동일하게 팩토리(`createCurriculumRepository`) + 지연초기화
 * 싱글턴(`curriculumRepository`) 패턴을 따른다. 다만 이 리포지토리는 사용자 요청 경로가
 * 아니라 오너가 직접 실행하는 관리용 CLI(`db:import-curriculum`)에서만 쓰이므로,
 * problemRepository의 "저장 실패를 삼킨다" 원칙과는 반대로 실패 시 그대로 throw한다 —
 * 임포트 스크립트가 부분 실패를 조용히 넘기면 데이터가 반쯤 섞인 채로 남기 때문이다.
 */
export interface CurriculumRepository {
  saveReferenceSource(input: ReferenceSourceInput): Promise<void>;
  saveCurriculumNodes(nodes: CurriculumNodeInput[]): Promise<void>;
  saveCurriculumPrerequisites(prerequisites: CurriculumPrerequisiteInput[]): Promise<void>;
}

export class CurriculumRepositoryError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`[curriculumRepository] ${operation} 실패: ${String(cause)}`);
    this.name = "CurriculumRepositoryError";
  }
}

function throwIfError(operation: string, error: unknown): void {
  if (error) {
    throw new CurriculumRepositoryError(operation, error);
  }
}

/** `curriculum_nodes`에서 code→id 매핑을 만들 때 쓰는 조회 결과 행 shape. */
interface NodeIdRow {
  id: string;
  code: string;
}

export function createCurriculumRepository(client: SupabaseClient): CurriculumRepository {
  return {
    async saveReferenceSource(input) {
      const { error } = await client.from("reference_sources").upsert(
        {
          name: input.name,
          publisher: input.publisher,
          source_url: input.sourceUrl,
          source_type: input.sourceType,
          subject: input.subject,
          curriculum_version: input.curriculumVersion,
          license_type: input.licenseType,
          license_url: input.licenseUrl,
          license_verified: input.licenseVerified,
          usage_mode: input.usageMode,
          attribution_text: input.attributionText,
          retrieved_at: input.retrievedAt,
          notes: input.notes,
        },
        { onConflict: "source_url" },
      );
      throwIfError("saveReferenceSource", error);
    },

    async saveCurriculumNodes(nodes) {
      if (nodes.length === 0) return;

      // 1차: parent_id를 항상 null로 두고 code 기준 upsert.
      // (자식 노드가 배열상 부모보다 먼저 오더라도 FK 에러 없이 먼저 행을 만들어 둔다.)
      const firstPassRows = nodes.map((node) => ({
        code: node.code,
        subject: node.subject,
        node_type: node.nodeType,
        parent_id: null,
        name: node.name,
        description: node.description,
        curriculum_version: node.curriculumVersion,
        csat_importance: node.csatImportance,
        difficulty_base: node.difficultyBase,
        allowed_scope: node.allowedScope,
        forbidden_scope: node.forbiddenScope,
        // Stage 1 결정사항 D: 교육과정 트리 자체는 source_id를 갖지 않는다.
        source_id: null,
        is_active: node.isActive,
      }));

      const firstPassResult = (await client
        .from("curriculum_nodes")
        .upsert(firstPassRows, { onConflict: "code" })
        .select("id, code")) as { data: NodeIdRow[] | null; error: unknown };
      throwIfError("saveCurriculumNodes.upsert", firstPassResult.error);

      const idByCode = new Map((firstPassResult.data ?? []).map((row) => [row.code, row.id]));

      // 2차: code→id 맵을 이용해 parent_id만 개별 update.
      for (const node of nodes) {
        if (!node.parentCode) continue;

        const parentId = idByCode.get(node.parentCode);
        if (!parentId) {
          throw new CurriculumRepositoryError(
            "saveCurriculumNodes.updateParent",
            `부모 코드 ${node.parentCode}의 id를 찾을 수 없습니다(code=${node.code})`,
          );
        }

        const { error } = await client
          .from("curriculum_nodes")
          .update({ parent_id: parentId })
          .eq("code", node.code);
        throwIfError("saveCurriculumNodes.updateParent", error);
      }
    },

    async saveCurriculumPrerequisites(prerequisites) {
      if (prerequisites.length === 0) return;

      const codes = Array.from(
        new Set(prerequisites.flatMap((prerequisite) => [prerequisite.nodeCode, prerequisite.prerequisiteNodeCode])),
      );

      const lookupResult = (await client
        .from("curriculum_nodes")
        .select("id, code")
        .in("code", codes)) as { data: NodeIdRow[] | null; error: unknown };
      throwIfError("saveCurriculumPrerequisites.lookup", lookupResult.error);

      const idByCode = new Map((lookupResult.data ?? []).map((row) => [row.code, row.id]));

      const rows = prerequisites.map((prerequisite) => {
        const nodeId = idByCode.get(prerequisite.nodeCode);
        const prerequisiteNodeId = idByCode.get(prerequisite.prerequisiteNodeCode);
        if (!nodeId || !prerequisiteNodeId) {
          throw new CurriculumRepositoryError(
            "saveCurriculumPrerequisites.resolve",
            `노드 코드를 찾을 수 없습니다(node=${prerequisite.nodeCode}, prerequisite=${prerequisite.prerequisiteNodeCode})`,
          );
        }
        return {
          node_id: nodeId,
          prerequisite_node_id: prerequisiteNodeId,
          strength: prerequisite.strength,
          notes: prerequisite.notes,
        };
      });

      const { error } = await client
        .from("curriculum_prerequisites")
        .upsert(rows, { onConflict: "node_id,prerequisite_node_id" });
      throwIfError("saveCurriculumPrerequisites.upsert", error);
    },
  };
}

/**
 * 운영용 기본 인스턴스. CLI 스크립트가 이걸 직접 import해서 쓴다(problemRepository와 동일 패턴).
 * Supabase 클라이언트는 모듈 로드 시점이 아니라 첫 호출 시점에 만든다(환경변수가 비어있는
 * 테스트 환경에서 import만으로 앱 부트스트랩이 깨지지 않게 하기 위함).
 */
let defaultRepository: CurriculumRepository | undefined;

function getDefaultRepository(): CurriculumRepository {
  defaultRepository ??= createCurriculumRepository(getSupabaseServerClient());
  return defaultRepository;
}

export const curriculumRepository: CurriculumRepository = {
  async saveReferenceSource(input) {
    await getDefaultRepository().saveReferenceSource(input);
  },
  async saveCurriculumNodes(nodes) {
    await getDefaultRepository().saveCurriculumNodes(nodes);
  },
  async saveCurriculumPrerequisites(prerequisites) {
    await getDefaultRepository().saveCurriculumPrerequisites(prerequisites);
  },
};
