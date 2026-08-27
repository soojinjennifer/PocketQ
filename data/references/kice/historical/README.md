# SILVER A — 역대 평가원 기출(현재 0건)

이 디렉터리는 SILVER A 증거 등급(`exam_reference_sets.evidence_tier = 'SILVER_KICE'`,
`exam_type` in `CSAT`/`JUNE_MOCK`/`SEPT_MOCK`/`OTHER_MOCK`)에 해당하는 역대 한국교육과정
평가원 기출 자료를 위한 확장 슬롯이다.

## 현재 상태: 0건

2022 개정 교육과정은 2028학년도 대학수학능력시험부터 처음 적용되는 새 체제다. 과거
수능/모의평가(예: 2015 개정 교육과정 기반 "수학Ⅰ/수학Ⅱ/확률과 통계/미적분/기하")는 과목
구성과 범위가 달라 완전히 호환되는 과거 기출이 사실상 없다. 그래서 Stage 3 파이프라인은
현재 SILVER_KICE 자료를 하나도 등록하지 않는다.

**이 상태에서도 파이프라인은 정상적으로 완료된다** — `csatRelevanceScoring.ts`의
`redistributeWeights(hasAnySilverEvidenceInCorpus)`가 SILVER 증거가 없을 때 Historical
차원(20%)의 가중치를 Gold/Curriculum/Reasoning/Reference 4개 차원에 비례 재분배하고,
`familyApprovalWorkflow.ts`의 "의미있는 증거" 게이트도 SILVER 없이 GOLD 증거 단독으로
통과할 수 있게 설계되어 있다.

## 향후 확장 방법

향후 오너가 아래 조건을 만족하는 과거 기출을 확보하면 이 디렉터리에 추가할 수 있다:

1. 2022 개정 교육과정 "대수"/"미적분Ⅰ"과 **직접 호환 가능**하다고 판단되는 단원/개념만
   선별한다(호환 여부는 `exam_item_features.curriculum_compatibility`에 문항 단위로
   명시해야 하며, `historicalCompatibilityGuard.ts`가 `INCOMPATIBLE` 항목을 스코어링에서
   자동으로 제외한다).
2. 정확한 출처(연도/시험 종류/발행 기관/저작권 상태)를 `source.json`에 기록한다.
3. `exam_reference_sets.evidence_tier = 'SILVER_KICE'`로 등록한다.
4. 문항 원문 전체를 저장하지 않는다 — 이 프로젝트의 다른 모든 참고자료와 동일하게 추상화된
   구조적 특징만 `exam_item_features`에 저장한다.

과거 기출 자료를 실제로 확보하기 전까지는 이 디렉터리에 PDF나 JSON 데이터를 추가하지
않는다(허위 자료로 채우지 않음).
