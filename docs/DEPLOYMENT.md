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

> ⚠️ **도메인 주의 (반드시 지킬 것)**: `app.groundmoyo.com`은 기존 서비스 **"내편문서"가 사용 중인
> 도메인**입니다. PocketQ 배포 과정에서 이 도메인의 DNS 레코드를 수정·삭제하거나 PocketQ의 어떤
> 서비스에도 연결하지 않습니다. PocketQ는 아래 전용 서브도메인만 사용합니다.
>
> | 서비스 | 운영 도메인 |
> |---|---|
> | `pocketq-web` (프런트엔드) | `https://pocketq.groundmoyo.com` |
> | `pocketq-api` (백엔드 API) | `https://pocketq-api.groundmoyo.com` |
> | `pocketq-cas` (Private Service) | 외부 도메인 없음(내부 전용, Render Private Service는 Custom Domain 자체를 지원하지 않음) |

## 배포 순서 (중요 — 이 순서를 지켜야 처음부터 값을 채울 수 있습니다)

1. **`pocketq-cas`** (Private Service, `region: singapore`) 먼저 생성 → 생성 후 대시보드에 표시되는 **Internal Address**를 복사해둔다.
2. **`pocketq-api`** (Web Service, `region: singapore` — `pocketq-cas`와 반드시 같은 리전으로 생성) 생성 → 환경변수 입력 시 `CAS_SERVICE_URL`에 1번에서 복사한 주소를 넣는다(비워둬도 배포는 되지만 CAS 검증은 스텁으로 폴백함, 아래 참고). 생성 후 공개 URL(`https://pocketq-api.onrender.com` 또는 커스텀 도메인)을 확인해둔다.
3. **`pocketq-web`** (Static Site) 생성 → `VITE_API_BASE_URL`에 2번의 공개 URL을 넣는다.
4. `pocketq-web`에 커스텀 도메인 `pocketq.groundmoyo.com`, `pocketq-api`에 커스텀 도메인 `pocketq-api.groundmoyo.com` 연결(아래 "도메인 연결" 참고) → 확정되면 `pocketq-api`의 `CORS_ORIGIN`과 `pocketq-web`의 `VITE_API_BASE_URL`을 최종 도메인으로 갱신하고 재배포.
5. Supabase 프로젝트(`SUPABASE_URL`이 가리키는 프로젝트) 대시보드 → Authentication → URL Configuration에서 Site URL/Redirect URLs을 갱신(아래 "Supabase Auth 설정" 참고).

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
| `CORS_ORIGIN` | `https://pocketq.groundmoyo.com` | 로컬도 병행 테스트하려면 `https://pocketq.groundmoyo.com,http://localhost:5173` |
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
| `VITE_API_BASE_URL` | `https://pocketq-api.groundmoyo.com`(도메인 연결 전 임시로는 `pocketq-api`의 `onrender.com` 공개 URL) | 빌드 타임에 번들에 고정되므로, 값이 바뀌면 반드시 재배포(재빌드) 필요 |

## 도메인 연결 (`pocketq.groundmoyo.com` / `pocketq-api.groundmoyo.com`)

> `app.groundmoyo.com`은 "내편문서"가 쓰고 있는 도메인입니다. 아래 절차에서 이 도메인이나 그
> 기존 DNS 레코드는 절대 수정·삭제하지 않습니다 — PocketQ는 신규 서브도메인만 추가합니다.

1. `pocketq-web` 서비스의 Settings → Custom Domains에서 `pocketq.groundmoyo.com` 추가.
2. `pocketq-api` 서비스의 Settings → Custom Domains에서 `pocketq-api.groundmoyo.com` 추가.
3. Render가 각 서비스별로 안내하는 값(보통 CNAME, 대상은 서비스별 `*.onrender.com`)을 `groundmoyo.com`을 관리하는 DNS 제공업체에 **신규 레코드로 추가**한다(기존 `app.groundmoyo.com` 레코드는 그대로 둔다).
4. DNS 전파 후 Render가 자동으로 Let's Encrypt 인증서를 발급(추가 조치 불필요).
5. `pocketq-cas`는 Private Service라 Custom Domain 설정 항목 자체가 없다 — 아무 도메인도 연결하지 않는다(연결할 필요도, 방법도 없음).

## Supabase Auth 설정 (Site URL / Redirect URLs)

프런트엔드의 소셜 로그인·비밀번호 재설정 흐름(`apps/web/src/features/auth/useAuthActions.ts`)은
`redirectTo: window.location.origin`을 그대로 Supabase에 전달합니다 — 즉 실제 접속 도메인이 그대로
redirect 대상이 되므로, Supabase가 그 도메인을 허용 목록에 갖고 있어야 합니다.

`SUPABASE_URL`/`VITE_SUPABASE_URL`이 가리키는 **PocketQ의 Supabase 프로젝트**에서, 대시보드 →
Authentication → URL Configuration을 아래처럼 설정합니다.

| 항목 | 값 |
|---|---|
| Site URL | `https://pocketq.groundmoyo.com` |
| Redirect URLs (추가) | `https://pocketq.groundmoyo.com`, `https://pocketq.groundmoyo.com/**` |
| Redirect URLs (로컬 개발용, 유지) | `http://localhost:5173`, `http://localhost:5173/**` |

**주의**: 이 프로젝트를 "내편문서"와 같은 Supabase 프로젝트를 공유해서 쓰고 있다면, 기존에 등록된
`app.groundmoyo.com` 계열 Redirect URL 항목은 **삭제하지 말고 그대로 둔 채 PocketQ 항목만 추가**합니다
(다른 프로젝트를 쓰고 있다면 이 문단은 해당 없음).

## `profiles` 테이블 마이그레이션 적용 (§3.37)

`supabase/migrations/20260909000000_profiles.sql` 파일은 아직 어떤 DB에도 적용되지 않았습니다.
배포 전(또는 직후) 아래 순서로 Supabase 대시보드 → SQL Editor에서 실행하세요(이 저장소의 기존
마이그레이션들과 동일한 적용 방식 — Supabase CLI가 이 프로젝트에 설정돼 있지 않음).

1. **마이그레이션 적용**: `supabase/migrations/20260909000000_profiles.sql` 파일 내용을 그대로
   붙여넣어 실행.
2. **스키마 검증**: 테이블/컬럼이 의도대로 생겼는지 확인.
   ```sql
   select column_name, data_type, is_nullable, column_default
   from information_schema.columns
   where table_name = 'profiles'
   order by ordinal_position;
   ```
3. **트리거 검증**: 신규 가입 시 자동 생성 트리거가 활성 상태인지 확인(`tgenabled = 'O'`).
   ```sql
   select tgname, tgrelid::regclass, tgenabled
   from pg_trigger
   where tgname = 'on_auth_user_created';
   ```
4. **RLS/정책 검증**: RLS가 켜져 있고 `profiles_select_own` SELECT 정책만 존재하는지 확인
   (INSERT/UPDATE/DELETE 정책이 하나도 없어야 정상 — 클라이언트가 `plan`/`trial_ends_at`을
   직접 못 바꾸게 하려는 의도적 설계).
   ```sql
   select relrowsecurity from pg_class where relname = 'profiles';
   select policyname, cmd from pg_policies where tablename = 'profiles';
   ```
5. **동작 검증**: 배포된 `pocketq-web`에서 신규 계정으로 실제 가입을 한 번 해보고, 트리거로
   `profiles` 행이 자동 생성됐는지 최종 확인.
   ```sql
   select id, plan, trial_ends_at, created_at
   from profiles
   order by created_at desc
   limit 5;
   ```

**주의**: 이 마이그레이션의 트리거는 신규 가입(`auth.users` INSERT)에만 반응합니다 — 이미 가입한 기존 사용자에게는 `profiles` 행이 생기지 않습니다. 지금은 스키마만 준비하는 단계라 문제 없지만, 나중에 실제로 트라이얼 만료/과금 로직을 켤 때는 기존 가입자용 백필(예: `insert into profiles (id, trial_ends_at) select id, now() + interval '15 days' from auth.users where id not in (select id from profiles)`)이 별도로 필요합니다.

## 배포 전 마지막 확인

- 이번 세션에서 `apps/api`의 컴파일 산출물(`tsc` 빌드)을 `node`로 직접 실행하면 `ERR_MODULE_NOT_FOUND`가 나는 것을 재현·확인했습니다(TypeScript `moduleResolution: "bundler"` 설정이 컴파일된 JS에 `.js` 확장자를 안 붙이기 때문). 그래서 `pocketq-api`는 별도 컴파일 없이 `tsx`로 TypeScript를 직접 실행하도록 구성했습니다(`apps/api/package.json`의 `start` 스크립트, `tsx`는 devDependencies에서 dependencies로 옮김). 이 방식은 정상 동작을 로컬에서 직접 확인했습니다.
- `services/cas`는 `uv.lock` 기반이라 Render 빌드 시 `pip install uv`로 uv 자체를 먼저 설치합니다(README에 "프로덕션 배포는 범위 밖"이라고 명시돼 있던 부분 — 이번에 처음 Render 대상으로 구성).

## 배포 설정 검증 체크리스트

이번 점검에서 아래 항목을 실제로 확인했습니다(코드 변경은 하지 않고 설정/문서만 수정).

| # | 항목 | 결과 |
|---|---|---|
| 1 | `render.yaml`이 Blueprint로 3개 서비스를 생성할 수 있는 구조인가 | `python3 -c "import yaml..."`로 파싱 검증 — `pocketq-web`/`pocketq-api`/`pocketq-cas` 3개 서비스가 정상 파싱됨. Render 실계정 업로드 검증은 여전히 미실시(계정 접근 권한 없음, 위 경고문 참고) |
| 2 | `pocketq-cas`와 `pocketq-api`가 같은 리전인가 | 둘 다 `region: singapore`로 명시 추가(기존에는 리전 미지정으로 암묵적 기본값에 의존 — 이번에 명시적으로 고정) |
| 3 | `pocketq-api`가 CAS의 Render 내부 주소를 쓰는가 | `CAS_SERVICE_URL` env var가 Private Service의 Internal Address를 받도록 이미 구성돼 있음(`apps/api/src/infrastructure/cas/resolveCasClient.ts`가 이 값을 사용, 비어 있으면 스텁 폴백) |
| 4 | `pocketq-web`이 CAS를 직접 호출하지 않고 `pocketq-api`만 호출하는가 | `apps/web/src`에 CAS 관련 참조가 전혀 없음을 grep으로 확인(`CAS_SERVICE_URL`/`casServiceUrl`/CAS 호출 코드 없음) — 프런트는 `VITE_API_BASE_URL`(`pocketq-api`)만 호출 |
| 5 | API가 `process.env.PORT`와 `0.0.0.0`에 바인딩되는가 | `apps/api/src/config/env.ts`가 `process.env.PORT`를 읽고(`apps/api/src/server.ts`), `server.listen(env.port, ...)`에 host를 명시하지 않아 Node 기본 동작대로 모든 인터페이스에 바인딩됨(로컬 전용 `127.0.0.1` 제한 없음) — 코드 변경 불필요, 이미 Render 배포에 적합 |
| 6 | 프런트엔드 React Router용 `/* → /index.html` Rewrite가 있는가 | `render.yaml`의 `pocketq-web.routes`에 이미 존재(변경 없음) |
| 7 | `render.yaml`에 실제 secret 값이 없는가 | 시크릿성 env var(`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CORS_ORIGIN`, `VITE_API_BASE_URL`, `CAS_SERVICE_URL`)가 전부 `sync: false`로 값 없이 선언돼 있음을 재확인. 값이 박혀 있는 항목은 `NODE_ENV=production`/`AI_PROVIDER=openai`/`RATE_LIMIT_*`/`region: singapore` 뿐이며 모두 비민감 설정값 |
| 8 | 환경변수 이름을 서비스별로 표로 정리했는가 | 위 "서비스별 환경변수 체크리스트" 3개 표(`pocketq-cas`/`pocketq-api`/`pocketq-web`)로 이미 정리돼 있음(이번에 값만 새 도메인으로 갱신) |
| 9 | `profiles` 마이그레이션 적용·검증 SQL 순서가 명시돼 있는가 | 위 "`profiles` 테이블 마이그레이션 적용" 절에 적용→스키마 검증→트리거 검증→RLS/정책 검증→동작 검증까지 5단계로 명시(이번에 추가) |
