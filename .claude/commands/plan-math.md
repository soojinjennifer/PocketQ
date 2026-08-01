---
description: plan-agent로 화면/기능 구현 전 구조·영향범위·재사용 컴포넌트·작업순서를 분석한다 (읽기 전용)
argument-hint: [구현하려는 화면 또는 기능 설명]
allowed-tools: Agent
---

`plan-agent` 서브에이전트를 호출하여 아래 화면/기능에 대한 구현 계획을 세운다.

대상: $ARGUMENTS

## 실행 지침

- 반드시 `subagent_type: plan-agent`로 Agent 도구를 호출한다.
- plan-agent는 읽기 전용(Read, Grep, Glob)이다. 코드를 수정하지 않는다.
- 프롬프트에는 다음을 포함한다:
  - 사용자가 구현하려는 화면/기능: $ARGUMENTS
  - 참조 우선순위: `docs/PRD_WHYMATH.md` > `docs/FIGMA_SCREEN_MAP.md` > `docs/DESIGN_SYSTEM.md`/`docs/DESIGN_TOKEN_MAP.md`/`docs/COMPONENT_MAP.md` > `docs/PROJECT_STRUCTURE.md` > `.claude/rules/frontend.md`
  - 분석 항목 8가지(에이전트 정의 참조): Figma 화면과 Claude Design 참고 자료 / 기존 디자인 토큰과 공통 UI / 재사용 컴포넌트 / 신규 컴포넌트와 Variant / pages·features·shared 책임 분리 / 영향받는 파일 / 구현 순서와 완료 조건 / 결정이 필요한 사항
  - 화면 전체를 하나의 컴포넌트로 만드는 계획은 금지한다는 제약
- $ARGUMENTS가 비어 있으면, 무엇을 계획할지 사용자에게 먼저 물어본다 (임의로 화면을 추측하지 않는다).
- Agent 결과를 받으면 그대로 사용자에게 요약해서 보여준다. 다음 단계로 필요 시 `design-agent`(사전 검토) → `development-agent` → `design-agent`(사후 검수) 순서를 안내한다.
