import { readFileSync } from "node:fs";
import { curriculumRepository } from "../curriculumRepository";
import { CURRICULUM_SOURCE_PATHS, loadCurriculumSource, resolveRepoPath } from "../loadCurriculumSource";
import { referenceSourceSchema } from "../referenceSourceSchema";

/**
 * `data/references/**\/source.json` 매니페스트 경로 목록.
 * ProblemDB/(AI-Hub 데이터셋) 처리는 Stage 1 범위 밖이므로 다루지 않는다.
 */
const REFERENCE_SOURCE_PATHS = ["data/references/mathjk/source.json"] as const;

/**
 * Problem DB Stage 1 임포터.
 *
 * 순서: 1) 소스 검증(교육과정 그래프 + 참고자료 스키마, 실패 시 DB에 아무것도 쓰지 않고 중단)
 *       2) reference_sources upsert  3) curriculum_nodes 2-패스 upsert  4) curriculum_prerequisites upsert
 * `delete` 문은 없다. usageMode/licenseVerified는 JSON 값을 그대로 전달한다(승격 로직 없음).
 */
async function main(): Promise<void> {
  const curriculumSources = Object.entries(CURRICULUM_SOURCE_PATHS).map(([label, relativePath]) => ({
    label,
    ...loadCurriculumSource(relativePath),
  }));

  const graphErrors = curriculumSources.flatMap(({ label, validation }) =>
    validation.errors.map((message) => `[${label}] ${message}`),
  );

  const referenceSources = REFERENCE_SOURCE_PATHS.map((relativePath) => {
    const raw = readFileSync(resolveRepoPath(relativePath), "utf-8");
    return referenceSourceSchema.parse(JSON.parse(raw) as unknown);
  });

  if (graphErrors.length > 0) {
    console.error("교육과정 그래프 검증에 실패했습니다 — DB에 아무것도 쓰지 않습니다.");
    for (const message of graphErrors) {
      console.error(` - ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  for (const referenceSource of referenceSources) {
    await curriculumRepository.saveReferenceSource(referenceSource);
    console.log(`reference_sources upsert 완료: ${referenceSource.sourceUrl}`);
  }

  for (const { label, source } of curriculumSources) {
    await curriculumRepository.saveCurriculumNodes(source.nodes);
    console.log(`curriculum_nodes upsert 완료: ${label} (${source.nodes.length}개 노드)`);
  }

  for (const { label, source } of curriculumSources) {
    await curriculumRepository.saveCurriculumPrerequisites(source.prerequisites);
    console.log(`curriculum_prerequisites upsert 완료: ${label} (${source.prerequisites.length}개 관계)`);
  }

  console.log("Problem DB Stage 1 임포트 완료.");
}

main().catch((error: unknown) => {
  console.error("교육과정 임포트 실패", error);
  process.exitCode = 1;
});
