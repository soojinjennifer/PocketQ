whymath/
├─ apps/
│  ├─ web/                              # React + Vite 프론트엔드
│  │  ├─ public/
│  │  │  ├─ icons/                     # PWA 앱 아이콘
│  │  │  └─ images/
│  │  │
│  │  ├─ src/
│  │  │  ├─ app/                       # 앱 시작과 전역 설정
│  │  │  │  ├─ App.tsx
│  │  │  │  ├─ router.tsx
│  │  │  │  ├─ providers.tsx
│  │  │  │  ├─ query-client.ts
│  │  │  │  └─ route-guard.tsx
│  │  │  │
│  │  │  ├─ pages/                     # URL 단위 화면
│  │  │  │  ├─ login/
│  │  │  │  ├─ grade-setup/
│  │  │  │  ├─ solve/
│  │  │  │  ├─ mypage/                 # 이력·프로필은 별도 라우트가 아닌 내부 영역
│  │  │  │  ├─ camera/
│  │  │  │  │  └─ preview/             # /camera/preview (nested route)
│  │  │  │  └─ not-found/
│  │  │  │
│  │  │  ├─ features/                  # 사용자 기능 단위
│  │  │  │  ├─ auth/
│  │  │  │  ├─ grade-setup/
│  │  │  │  ├─ problem-input/
│  │  │  │  ├─ drawing-canvas/
│  │  │  │  ├─ camera/
│  │  │  │  ├─ problem-recognition/
│  │  │  │  ├─ solve-session/
│  │  │  │  ├─ ai-solution/
│  │  │  │  ├─ follow-up-chat/
│  │  │  │  ├─ similar-problems/
│  │  │  │  └─ learning-history/
│  │  │  │
│  │  │  ├─ shared/                    # 앱 전체 공통 코드
│  │  │  │  ├─ ui/
│  │  │  │  │  ├─ button/
│  │  │  │  │  ├─ icon-button/
│  │  │  │  │  ├─ input/
│  │  │  │  │  ├─ card/
│  │  │  │  │  ├─ modal/
│  │  │  │  │  ├─ toast/
│  │  │  │  │  ├─ spinner/
│  │  │  │  │  └─ app-shell/
│  │  │  │  ├─ api/                   # API 클라이언트 공통 설정
│  │  │  │  ├─ hooks/
│  │  │  │  ├─ lib/
│  │  │  │  │  ├─ supabase/
│  │  │  │  │  ├─ math/
│  │  │  │  │  └─ storage/
│  │  │  │  ├─ config/
│  │  │  │  ├─ constants/
│  │  │  │  ├─ types/
│  │  │  │  └─ styles/
│  │  │  │     ├─ theme.css
│  │  │  │     ├─ globals.css
│  │  │  │     └─ safe-area.css
│  │  │  │
│  │  │  ├─ assets/
│  │  │  ├─ test/
│  │  │  │  └─ setup.ts
│  │  │  └─ main.tsx
│  │  │
│  │  ├─ .env.example
│  │  ├─ index.html
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ vite.config.ts
│  │
│  └─ api/                              # Node.js + Express API
│     ├─ src/
│     │  ├─ app.ts                     # Express 앱 구성
│     │  ├─ server.ts                  # 서버 실행
│     │  │
│     │  ├─ bootstrap/
│     │  │  └─ container.ts            # 의존성 연결
│     │  │
│     │  ├─ config/
│     │  │  ├─ env.ts
│     │  │  ├─ cors.ts
│     │  │  └─ logger.ts
│     │  │
│     │  ├─ middleware/
│     │  │  ├─ authenticate.ts
│     │  │  ├─ validate-request.ts
│     │  │  ├─ error-handler.ts
│     │  │  ├─ rate-limiter.ts
│     │  │  └─ request-logger.ts
│     │  │
│     │  ├─ modules/
│     │  │  ├─ health/
│     │  │  ├─ profiles/
│     │  │  ├─ solve-sessions/
│     │  │  ├─ recognition/
│     │  │  ├─ solutions/
│     │  │  ├─ chat/
│     │  │  └─ history/
│     │  │
│     │  ├─ infrastructure/
│     │  │  ├─ supabase/
│     │  │  │  ├─ client.ts
│     │  │  │  └─ repositories/
│     │  │  ├─ ai/
│     │  │  │  ├─ solution-generator.ts
│     │  │  │  └─ providers/
│     │  │  ├─ storage/
│     │  │  └─ observability/
│     │  │
│     │  └─ shared/
│     │     ├─ errors/
│     │     ├─ result/
│     │     ├─ types/
│     │     └─ utils/
│     │
│     ├─ tests/
│     │  ├─ integration/
│     │  └─ fixtures/
│     ├─ .env.example
│     ├─ package.json
│     └─ tsconfig.json
│
├─ packages/                            # 둘 이상의 앱이 실제로 타입을 공유할 때만 도입 (v1 미사용)
│  └─ contracts/                        # 프론트·백엔드 공통 계약
│     ├─ src/
│     │  ├─ auth/
│     │  ├─ profile/
│     │  ├─ solve-session/
│     │  ├─ solution/
│     │  ├─ chat/
│     │  ├─ common/
│     │  └─ index.ts
│     ├─ package.json
│     └─ tsconfig.json
│
├─ supabase/
│  ├─ schemas/                          # 새 프로젝트 DB 선언
│  │  ├─ profiles.sql
│  │  ├─ solve-sessions.sql
│  │  ├─ solutions.sql
│  │  ├─ chat.sql
│  │  ├─ storage.sql
│  │  └─ policies.sql
│  ├─ migrations/                       # 실제 DB 변경 이력
│  ├─ tests/
│  │  └─ rls/
│  ├─ seed.sql
│  └─ config.toml
│
├─ tests/
│  └─ e2e/                              # Playwright 전체 시나리오
│     ├─ auth.spec.ts
│     ├─ solve-flow.spec.ts
│     └─ history.spec.ts
│
├─ docs/
│  ├─ PROJECT_OVERVIEW.md
│  ├─ PROTOTYPE_AUDIT.md
│  ├─ ARCHITECTURE.md
│  ├─ COMPONENT_MAP.md
│  ├─ DESIGN_SYSTEM.md
│  ├─ DATA_MODEL.md
│  ├─ API_SPEC.md
│  ├─ IMPLEMENTATION_PLAN.md
│  ├─ TEST_PLAN.md
│  ├─ DEPLOYMENT.md
│  ├─ decisions/                        # 주요 기술 결정 기록
│  └─ prompts/                          # 단계별 Claude 프롬프트
│
├─ references/
│  └─ claude-design/
│     ├─ whymath-prototype.html         # 디자인 참고용 원본
│     ├─ screenshots/
│     └─ assets/
│
├─ scripts/                             # 개발·검증 자동화 스크립트
├─ CLAUDE.md                            # Claude Code 상시 개발 규칙
├─ render.yaml                          # Render 배포 설정
├─ package.json                         # 전체 공통 명령어
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ tsconfig.base.json
├─ eslint.config.js
├─ .prettierrc
├─ .gitignore
├─ .node-version
└─ README.md