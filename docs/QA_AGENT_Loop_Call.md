어떻게 호출할까

두 파일을 만든 뒤에는 명시적으로 @호출하는 방식을 기본으로 쓰는 것을 추천합니다. Claude Code의 현재 방식에서는 자연어로 Agent 이름을 말하면 위임 여부를 Claude가 판단하지만, @mention은 해당 Agent 실행을 보장합니다.

앞으로 개발 단계가 끝날 때는 이렇게만 입력하면 됩니다.

@stage-qa-agent

9단계 구현이 완료됐어.
이번 단계의 PRD Acceptance Criteria와 관련 regression을 검증하고
다음 단계로 넘어가도 되는지 판정해줘.

수정 사항이 나오면:

@development-agent

stage-qa-agent가 발견한 BLOCKER/HIGH 항목을 수정해줘.
PRD 범위를 확대하지 말고 최소 변경으로 처리해줘.

수정 후에는 다시:

@stage-qa-agent

수정이 끝났어.
이전 FAIL 항목을 포함해서 Stage QA를 처음부터 다시 실행해줘.

그리고 MVP 전체 개발이 끝났을 때 단 한 번의 기능 테스트가 아니라 독립 Release Audit으로:

@final-qa-agent

현재 WhyMath를 Release Candidate로 간주하고
PRD 전체 기준 Final QA를 처음부터 수행해줘.
이전 QA 결과를 신뢰하지 말고 실제 코드와 테스트 결과만으로 판정해줘.

Final QA만 완전히 별도 세션으로 돌리고 싶다면 Claude Code는 claude --agent <name>으로 그 Agent 자체를 메인 세션으로 시작하는 것도 지원합니다.

claude --agent final-qa-agent

이후:

WhyMath MVP Final QA를 수행해줘.

라고 하면 됩니다.

앞으로의 개발 사이클

이제 WhyMath의 개발 루프를 **Plan → Design(필요 시) → Development → Stage QA → Development Fix → Stage QA**로 고정하고, MVP가 완성된 시점에만 **Final QA → Release Blocker Fix → Final QA 재검증 → Release**를 수행하는 구조를 추천합니다.

특히 stage-qa-agent를 description에서 proactively 사용하도록 지정했기 때문에 Claude가 단계 완료 상황에서 자동 위임할 가능성도 높일 수 있습니다. 그래도 저는 중요한 검수에서는 직접 @stage-qa-agent를 호출하는 방식을 권합니다. 공식 문서상 이 방식이 가장 확실합니다.

이렇게 만들면 앞으로 “8단계 QA 프롬프트 다시 만들어줘”, “10단계 테스트 프롬프트 다시 만들어줘”를 반복할 필요가 없습니다. 단계 번호와 이번에 구현한 범위만 던지면 QA Agent가 PRD에서 알아서 검사항목을 찾아오는 구조가 됩니다. 🧪