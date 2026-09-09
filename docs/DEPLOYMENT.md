# Render 배포 가이드

> **주의**: 이 환경에는 Render 계정/CLI 접근 권한이 없어 `render.yaml`을 Render에 실제로 업로드해서
> 검증하지는 못했습니다(로컬에서 YAML 문법 유효성과 각 서비스의 빌드/실행 명령 자체는 직접 실행해
> 확인했습니다). Render의 Blueprint 스키마(`runtime`/`env` 필드명 등)는 시점에 따라 바뀔 수 있으니,
> 대시보드에서 Blueprint를 처음 연결할 때 필드 하나가 인식되지 않으면 Render 최신 문서와 대조해서
> 이름만 맞춰주세요 — 구조 자체(서비스 3개, 빌드/시작 명령, 환경변수 목록)는 이 세션에서 실제로
> 검증된 내용입니다.

`render.yaml`(저장소 루트)이 아래 3개 서비스를 Render Blueprint로 정의합니다. 이 문서는 대시보드에서
직접 채워야 하는 값과 순서를 정리합니다. **이 세션에서는 render.yaml 작성 + 로컬 빌드/실행 명령 검증까지만
진행했고, Render 계정 접근 권한이 없어 실제 서비스 생성·배포·도메인 연결은 오너가 직접 진행합니다.**

## 배포 순서 (중요 — 이 순서를 지켜야 처음부터 값을 채울 수 있습니다)

1. **`pocketq-cas`** (Private Service) 먼저 생성 → 생성 후 대시보드에 표시되는 **Internal Address**를 복사해둔다.
2. **`pocketq-api`** (Web Service) 생성 → 환경변수 입력 시 `CAS_SERVICE_URL`에 1번에서 복사한 주소를 넣는다(비워둬도 배포는 되지만 CAS 검증은 스텁으로 폴백함, 아래 참고). 생성 후 공개 URL(`https://pocketq-api.onrender.com` 또는 커스텀 도메인)을 확인해둔다.
3. **`pocketq-web`** (Static Site) 생성 → `VITE_API_BASE_URL`에 2번의 공개 URL을 넣는다.
4. `pocketq-web`에 커스텀 도메인 `app.groundmoyo.com` 연결(아래 "도메인 연결" 참고) → 확정되면 `pocketq-api`의 `CORS_ORIGIN`을 이 최종 도메인으로 갱신하고 재배포.

Render 대시보드에서 "New +" → "Blueprint"로 이 저장소를 연결하면 3개 서비스가 한 번에 제안되지만, 위 순서대로 값을 채우려면 하나씩 개별 생성(New + → Web Service / Static Site / Private Service)하는 편이 헷갈리지 않습니다. Blueprint로 한 번에 만들었다면, 생성 후 각 서비스의 Environment 탭에서 아래 값을 채우고 순서대로 재배포하면 됩니다.

## 서비스별 환경변수 체크리스트

### `pocketq-cas` (Private Service, 외부 비공개)

| 변수 | 값 |
|---|---|
| (없음) | `PORT`는 Render가 자동 주입, 별도 입력 불필요 |

CAS 엔드포인트(`/verify-work-lines`, `/verify-final-answer`)는 인증이 전혀 없습니다 — **반드시 Private Service로 생성**하세요(Web Service로 만들면 누구나 공개 인터넷에서 직접 호출할 수 있습니다). Render의 Private Service는 같은 Render 계정 안의 다른 서비스에서만 내부망으로 접근 가능합니다.

### `pocketq-api` (Web Service)

| 변수 | 값 | 비고 |
|---|---|---|
| `NODE_ENV` | `production` | render.yaml에 이미 고정값으로 있음 |
| `CORS_ORIGIN` | `https://app.groundmoyo.com` | 로컬도 병행 테스트하려면 `https://app.groundmoyo.com,http://localhost:5173` |
| `SUPABASE_URL` | 운영 Supabase 프로젝트 URL | |
| `SUPABASE_SERVICE_ROLE_KEY` | 운영 Supabase service role 키 | **절대 anon 키를 넣지 말 것** — `profiles` 테이블 RLS를 우회해서 써야 하는 서버 전용 키입니다(§3.37 참고) |
| `AI_PROVIDER` | `openai` | render.yaml에 이미 고정값으로 있음 |
| `AI_MODEL` | 로컬 `apps/api/.env`의 `AI_MODEL` 값과 동일 | **비워두면 서버가 기동 즉시 에러로 종료합니다**(이번 세션에 직접 재현·확인) |
| `OPENAI_API_KEY` | 운영용 OpenAI API 키 | 로컬 개발 키와 분리 권장(사용량 추적) |
| `CAS_SERVICE_URL` | `pocketq-cas`의 Internal Address | 비워두면 CAS는 결정론적 스텁으로 자동 폴백(`resolveCasClient.ts`) — RESUME/DIAG 검증이 실제 SymPy가 아니라 스텁으로 동작하니 운영에서는 반드시 채울 것 |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `30` / `60000` | render.yaml 기본값 그대로 두면 됨(버스트 방지용, §3.37 소프트 캡과는 별개) |

### `pocketq-web` (Static Site)

| 변수 | 값 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL` | 운영 Supabase 프로젝트 URL | `pocketq-api`와 동일 프로젝트 |
| `VITE_SUPABASE_ANON_KEY` | 운영 Supabase **anon** 키 | service role 키 아님(클라이언트에 노출되는 값이라 anon 키만 사용) |
| `VITE_API_BASE_URL` | `pocketq-api`의 공개 URL | 빌드 타임에 번들에 고정되므로, 값이 바뀌면 반드시 재배포(재빌드) 필요 |

## 도메인 연결 (`app.groundmoyo.com`)

1. `pocketq-web` 서비스의 Settings → Custom Domains에서 `app.groundmoyo.com` 추가.
2. Render가 안내하는 값(보통 CNAME, 대상은 서비스별 `*.onrender.com`)을 `groundmoyo.com`을 관리하는 DNS 제공업체에 등록.
3. DNS 전파 후 Render가 자동으로 Let's Encrypt 인증서를 발급(추가 조치 불필요).
4. `pocketq-api`도 API 전용 서브도메인(예: `api.app.groundmoyo.com`)을 원하면 같은 방식으로 연결 가능 — 필수는 아니며, Render 기본 `onrender.com` 주소를 계속 써도 동작에는 지장 없음(다만 브라우저 콘솔에 노출되는 API 주소가 `onrender.com`으로 보임).

## `profiles` 테이블 마이그레이션 적용 (§3.37)

`supabase/migrations/20260909000000_profiles.sql` 파일은 아직 어떤 DB에도 적용되지 않았습니다. 배포 전(또는 직후) Supabase 대시보드 → SQL Editor에서 이 파일 내용을 그대로 붙여넣어 실행하세요(이 저장소의 기존 마이그레이션들과 동일한 적용 방식 — Supabase CLI가 이 프로젝트에 설정돼 있지 않음).

**주의**: 이 마이그레이션의 트리거는 신규 가입(`auth.users` INSERT)에만 반응합니다 — 이미 가입한 기존 사용자에게는 `profiles` 행이 생기지 않습니다. 지금은 스키마만 준비하는 단계라 문제 없지만, 나중에 실제로 트라이얼 만료/과금 로직을 켤 때는 기존 가입자용 백필(예: `insert into profiles (id, trial_ends_at) select id, now() + interval '15 days' from auth.users where id not in (select id from profiles)`)이 별도로 필요합니다.

## 배포 전 마지막 확인

- 이번 세션에서 `apps/api`의 컴파일 산출물(`tsc` 빌드)을 `node`로 직접 실행하면 `ERR_MODULE_NOT_FOUND`가 나는 것을 재현·확인했습니다(TypeScript `moduleResolution: "bundler"` 설정이 컴파일된 JS에 `.js` 확장자를 안 붙이기 때문). 그래서 `pocketq-api`는 별도 컴파일 없이 `tsx`로 TypeScript를 직접 실행하도록 구성했습니다(`apps/api/package.json`의 `start` 스크립트, `tsx`는 devDependencies에서 dependencies로 옮김). 이 방식은 정상 동작을 로컬에서 직접 확인했습니다.
- `services/cas`는 `uv.lock` 기반이라 Render 빌드 시 `pip install uv`로 uv 자체를 먼저 설치합니다(README에 "프로덕션 배포는 범위 밖"이라고 명시돼 있던 부분 — 이번에 처음 Render 대상으로 구성).
