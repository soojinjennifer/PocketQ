Agent와 규칙 생성 → 디자인 토큰 추출 → 공통 UI 구현 → Builder에 컴포넌트 연결 → 화면 한 개 생성 → Claude Code 통합 → Design Agent 검수 → 다음 화면 반복

flowchart TD
    A["Figma 원본"] --> B["Plan Agent 분석"]
    B --> C["토큰·공통 UI 구축"]
    C --> D["Builder 화면 초안"]
    D --> E["Development Agent 통합"]
    E --> F["Design Agent 검수"]
    F -->|수정 필요| E
    F -->|통과| G["다음 화면"]


    ![process](image.png)


references/
└─ claude-design/
   ├─ source/              # Claude Design ZIP 압축 해제본
   ├─ screenshots/         # 화면별 기준 이미지
   ├─ assets/              # 로고, 아이콘, 일러스트
   └─ README.md            # Figma 링크와 화면 설명

docs/
├─ FIGMA_SCREEN_MAP.md
├─ DESIGN_SYSTEM.md
├─ DESIGN_TOKEN_MAP.md
├─ COMPONENT_MAP.md
└─ FRONTEND_IMPLEMENTATION_PLAN.md

서버 구동 명령어 
corepack pnpm -F web dev
종료시 
lsof -ti:5173 -sTCP:LISTEN | xargs kill