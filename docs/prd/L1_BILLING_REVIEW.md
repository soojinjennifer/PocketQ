# L1_BILLING 검증 결과 (plan-agent)

- 대상: L0 `docs/PRD_WHYMATH.md` §4.13 (BILL-1~10) ↔ L1 `docs/prd/L1_BILLING.md` ↔ 현재 코드·마이그레이션·문서
- 일자: 2026-10-28
- 판정: **오너 결정 필요** (차단 3건). 결정 후 L1을 수정하고 구현에 착수한다.
- 줄 번호는 검증 시점 기준이다.

## 반영 현황 (2026-10-28)

| 발견 # | 상태 | 반영 위치 |
|---|---|---|
| 5 | 반영 | L1 §3.3, §6.2, §7.1(`user_trials` 삭제, `profiles` 확장), §7.2, §9 Phase 1 · L0 §7, BILL-9 |
| 6 | 반영 | L1 §3.4 라우트 표·미들웨어 순서, §8 · L0 BILL-3 |
| 7 | 반영 | L1 §3.4, §8 (`subscription_required`) · L0 BILL-3 · `docs/API_SPEC.md` 공통 (코드 `ErrorCode` 추가는 구현 단계) |
| 11 | 반영 | L1 §3.4 (`status` 조건, `paid_mode_enabled`, `open_promo_start_at`) |
| 12 | 반영 | L1 §4.1 (설정값 기반 날짜, KST 달력 기준 문구, E1~E6 기대 문구 표) |
| 14 | 반영 | L1 §8 (`/api/billing/cancel/undo`) |
| 15 | 반영 | L0 §7 (`profiles`, `users` 논리 모델 주석, 결제 테이블 → L1) · `docs/API_SPEC.md` (billing은 구현 전까지 L1 §8 기준) |
| 16 | 반영 | L1 §6.1 (SDK v2, Idempotency-Key·orderId 규칙, `BILLING_DELETED`), §8 (웹훅은 조회 재확인만 신뢰, `CRON_SECRET`, DB 잠금) |
| 1 | 오너 결정 반영 (2026-10-28) | 학생 결제 + 보호자 동의: L1 §4.5, §7.1 `guardian_consents`, §8 · L0 BILL-11 |
| 2, 13 | 오너 결정 반영 (2026-10-28) | 처리방침 개정·7일 전 고지, 결제 기록 5년 분리 보관: L1 §7.1, §7.3 · L0 AUTH-4, BILL-12 |
| 3 | 오너 결정 반영 (2026-10-28) | 하루 전 결제 시도: L1 §5.1, §5.2, §5.3, §6.3 · L0 BILL-6 |
| 17 | 오너 결정 반영 (2026-10-28) | 유료 시작 2026-12-01 00:00 KST, 오픈 무료 운영 11/30까지: L1 §2, §3.2, §4.1, §9 · L0 §4.13 |
| 4, 8, 9, 10 | 오너 결정 대기 | L1 §11 Q10, Q14~Q16 |
| (추가) | 오너 결정 반영 (2026-10-28) | 약관 v1.0 제6조의 30일 체험 약속(`terms.html:61`) → 이용약관 v1.1로 7일 체험 개정(경과 조치 포함): `apps/web/public/terms.html`, L1 §3.3, §7.3, §9 · L0 BILL-1·2·12 |

## 요약

- L0와 L1의 ID 매핑은 BILL-1~10이 모두 연결됐고, 숫자(13,900원, 7일, 11/02~11/15, 11/16 00:00)도 일치한다.
- 차단 1: 서비스가 만 14세 이상 미성년자를 받는데, 현재 약관(`apps/web/public/terms.html:62`)이 "만 19세 미만은 법정대리인 동의"를 약속하고 있다. L1에는 이 절차가 없다.
- 차단 2: L1이 보관하려는 결제 정보가 AUTH-4(수집 최소화)와 `privacy.html:61`의 "승인 결과와 거래 번호만 보관" 문구와 맞지 않는다.
- 차단 3: L1 §5.2 Q4의 기본안(기간 종료 00:00, 결제 작업 03:00)을 따르면 정상 구독자도 매달 3시간 동안 차단된다.
- 코드: 서버 전용 `profiles` 테이블이 이미 설계돼 있지만 운영 DB에 적용되지 않았다. 기존 가입자 행도 없고, 이 테이블을 읽는 코드도 없다. 새 `user_trials` 테이블을 만들지 말고 `profiles`를 확장하는 것을 권장한다.

## 발견 사항

| # | 심각도 | 분류 | 내용 | 근거 | 수정 제안 | 오너 결정 |
|---|---|---|---|---|---|---|
| 1 | 차단 | L0↔L1 / 외부 가정 | 만 14세 이상 가입(AUTH-11). 약관은 "만 19세 미만 결제는 법정대리인 동의"를 약속했다. L1에 법정대리인 동의, 카드 명의자 확인, 미성년자 계약 취소권 고지가 없다. | L0 `PRD_WHYMATH.md:121`, `terms.html:62`, L1 §4.2 | 결제 주체(보호자 결제 / 학생 결제 + 보호자 동의)와 동의 확인 방법을 정한다. `subscription_consents`에 보호자 동의 필드를 두고 BILL-4 수용 기준에 추가한다. | Y (Q11) |
| 2 | 차단 | L0↔L1 | L1은 카드사, 마스킹 번호, customerKey, IP·UA를 저장한다. AUTH-4("이메일·닉네임·학년과 동의 기록만"), L0 §5 최소화 원칙, `privacy.html:61`과 충돌한다. 토스페이먼츠 처리위탁 항목도 처리방침에 없다. | L0 AUTH-4·§5, L1 §7.1, `privacy.html:61,84-87` | AUTH-4에 결제 기록 예외를 넣는 개정을 L1과 같은 커밋에 넣는다. 처리방침 개정 고지(시행 7일 전)를 출시 조건에 넣는다. IP·UA 저장이 꼭 필요한지 다시 검토한다. | Y (Q12) |
| 3 | 차단 | 내부 모순 | `period_end` = 다음 결제일 00:00이고 결제 작업이 03:00이면, 매달 00:00~03:00 동안 정상 구독자도 만료된다. `past_due`의 "기간 끝까지 이용"이 의미가 없어진다. `next_billing_at`과 `period_end`의 관계도 정의되지 않았다. | L1 §3.4, §5.2, §5.3, §6.3 | (a) `next_billing_at = period_end - 1일`로 두고 `past_due`면 period_end까지 이용. 또는 (b) period_end 뒤 유예 시간. 권장은 (a). | Y (Q13) |
| 4 | 중요 | L1↔코드 | 15일 체험은 SQL 파일(`handle_new_user` 트리거)로만 있고 운영 DB 적용이 확인되지 않았다(DEPLOYMENT는 "미적용"). `profiles`를 읽거나 쓰는 코드가 없다. E6 대상이 실제로 있는지 불확실하다. | `supabase/migrations/20260909000000_profiles.sql:22-35`, `docs/DEPLOYMENT.md:129,164`, `PROJECT_STATUS.md:649,655` | 운영 DB에서 확인한다. 미적용이면 BILL-2는 "모든 기존 회원 = E5"로 단순해진다. | Y (Q15) |
| 5 | 중요 | L1↔코드 | L1의 `user_trials`는 기존 `profiles`(서버 전용, SELECT 본인만)와 용도가 겹친다. `plan` 컬럼과 구독 상태가 이중으로 관리될 위험이 있다. | `profiles.sql:15-20,47-48`, L1 §7.1, §7.2 | `profiles`를 확장한다(아래 권고). 트리거를 7일로 바꾼다. | N |
| 6 | 중요 | L1↔코드 | 권한 확인이 막아야 할 AI 라우트가 "AI 풀이·후속 질문"으로만 적혀 있다. 실제 AI 호출 라우트는 recognize, work-lines, diagnose, solve, resume, chat, suggestions 7개다. reopen은 AI를 쓰지 않으므로 열람으로 허용한다. | `recognition.router.ts:201-210`, `work.router.ts:79`, `diagnosis.router.ts:78`, `solutions.router.ts:144`, `resume.router.ts:238`, `chat.router.ts:75`, `suggestions.router.ts:39`, `problems.router.ts:193` | BILL-3과 L1 §3.4에 7개 경로를 명시한다. `authenticate` 다음, `rateLimiter` 앞에 둔다. solve·resume는 SSE 헤더를 보내기 전에 402를 반환한다. | N |
| 7 | 중요 | L1↔코드 | 오류 코드 `SUBSCRIPTION_REQUIRED`(대문자)가 기존 규약(소문자 snake_case)과 다르다. | `packages/shared-types/src/index.ts:53-63`, `docs/API_SPEC.md:18` | `ErrorCode`에 `"subscription_required"`를 추가하고 `{error:{code,message}}` 형식으로 맞춘다. | N |
| 8 | 중요 | L1↔코드 | 하루 10회 소프트 캡이 UTC 자정 기준이라 KST로는 오전 9시에 초기화된다. 현재 "무료 한도"는 분당 30회(메모리 기반)와 차단하지 않는 하루 10회 경고뿐이다. | `problemRepository.ts:758`, `recognition.router.ts:16`, `rate-limiter.ts:15-37`, `render.yaml:119-122` | `plans.usage_limits`에 현재 값(`recognize_daily_soft:10, rpm:30`)을 그대로 적는다. 하루 경계를 KST로 바꿀지 정한다. | Y (Q16) |
| 9 | 중요 | 외부 가정 / 코드 | api가 `plan: free`라 15분 동안 요청이 없으면 잠든다. cron 정의가 없다. Render Cron Job은 유료다. | `render.yaml:77`, `render.yaml:28-145` | 유료 플랜, Render Cron Job(UTC 18:00 = KST 03:00), Supabase pg_cron+pg_net 중에서 정해 §6.3에 확정해 적는다. | Y (Q14) |
| 10 | 중요 | 내부 모순 | 체험이 가입 시점에 시작해서, 소셜 가입자는 AUTH-11 동의 게이트에서 체험 시간을 잃는다. 동의 기록은 클라이언트가 고칠 수 있는 `user_metadata`에 있어서 체험 시작 기준으로 쓰면 안전하지 않다. | L1 §3.2, L0 AUTH-11, `account.router.ts:36` | 가입 시점을 유지한다. 동의 시점을 기준으로 하려면 서버가 첫 동의를 확인한 시각을 `profiles`에 한 번만 쓴다. | Y (Q10) |
| 11 | 중요 | 내부 모순 | `basic_active` 조건이 기간만 보고 `status`를 보지 않아, `refunded`·`incomplete`도 기간 안이면 권한을 얻는다. `paid_mode_enabled`와 `open_promo_start_at`은 판정에 쓰이지 않는다. | L1 §3.4, §7.1 | 조건을 `status IN (active,cancel_scheduled,past_due) AND now<period_end`로 고친다. `paid_mode_enabled`는 삭제하거나, false일 때 `open_promo`로 취급한다고 정의한다. | N |
| 12 | 중요 | 내부 모순 / 테스트 불가 | "24시간 미만이면 '오늘 HH:MM'"은 종료가 다음 날 새벽이면 틀린다. "11월 15일까지" 같은 고정 문구는 무료 운영 연장 규칙과 충돌한다. E2 문구("1일 남았어요 계열")는 검증할 수 없다. | L1 §4.1, §9 | KST 달력 날짜 기준으로 "오늘/내일 HH:MM"을 쓴다. 날짜는 모두 `billing_settings` 값으로 만든다. E1~E6마다 기대 문구를 정확히 적는다. | N |
| 13 | 중요 | 외부 가정 | 결제 기록은 5년 보관해야 하는데(처리방침 `:70`), 사용자 FK가 `on delete cascade`라 계정 삭제 시 함께 지워진다. Q5(재가입 체험 재지급 방지)는 탈퇴 후 식별자를 남겨야 해서 최소화 원칙과 부딪힌다. | `persistence.sql:7`, `profiles.sql:16`, `privacy.html:70` | 결제 테이블 `user_id`는 `on delete set null`로 두고 보관 기간을 따로 관리한다. Q5는 해시값 보관 방식으로 법률 검토를 받는다. | Y (Q12) |
| 14 | 경미 | L1↔코드 | `POST /api/billing/resume`(해지 취소)가 기존 RESUME(이어풀기)와 이름이 겹친다. | L1 §8, `resume.router.ts:239` | `/api/billing/cancel/undo`로 바꾼다. | N |
| 15 | 경미 | L0↔L1 | L0 §7에 결제 테이블과 `profiles`가 없다. `users` 테이블은 실제로 없다. `docs/DATA_MODEL.md`는 빈 파일이고, `API_SPEC.md`는 solve·resume만 다룬다. | L0 §7, `docs/DATA_MODEL.md`, `API_SPEC.md:3` | L0 §7에 "결제·구독은 L1 §7" 한 줄과 `profiles`를 추가한다. API_SPEC에 billing 절을 만든다. | N |
| 16 | 경미 | 외부 가정 | 토스 확인 사항: SDK v2 `requestBillingAuth`, `Idempotency-Key`(최대 300자, 15일 유효), 웹훅 서명 여부(서명이 없을 수 있음), `BILLING_DELETED` 이벤트, orderId 규칙(6~64자). 빌링 API 경로는 공개 문서와 일치한다. | L1 §6.1, §8 | 웹훅은 조회 API로 재확인하는 방식만 신뢰한다. 계약 심사에서 미성년자 대상 서비스인 점을 알린다. | N |
| 17 | 중요 | 일정 | 자동결제 심사는 보통 1~2주 이상 걸린다. Phase 1~3을 11일, QA를 3일에 해야 하고, Figma에 결제 화면이 없다. 법정대리인 절차와 약관 개정 고지(7일)가 일정에 없다. 첫 결제는 E2가 아니라 E1·E5가 만료되는 11/16 00:00부터 생긴다. | L1 §9, `COMPONENT_MAP.md` | 11/16에는 Phase 1(권한 판정과 안내)만 켠다. 유료 전환은 `open_promo_end_at` 연장(예: 11/30)을 기본 시나리오로 잡는다. | Y |

## 코드 기준 데이터 모델·API 권고

- **`profiles` 확장 (`user_trials` 대체)**
  - 추가 컬럼: `trial_started_at`, `trial_source`(`signup_7d`/`legacy_15d`/`backfill`), `customer_key unique`.
  - `trial_ends_at`은 그대로 쓴다. `plan` 컬럼은 판정에 쓰지 않는다(Q18).
  - 트리거를 7일로 바꾸거나 `billing_settings.trial_days`를 참조하게 한다.
  - 백필: 값이 없는 사용자만 `가입+7일`로 채우고, 이미 값이 있는 행은 건드리지 않는다.
- **신규 테이블**: `billing_settings`, `plans`, `subscriptions`, `billing_methods`, `payment_orders`, `payment_attempts`, `subscription_consents`는 L1 설계대로 둔다. 차이는 두 가지다.
  - 결제 테이블의 `user_id`는 `on delete set null`로 둔다.
  - `subscription_consents`에 보호자 동의 필드를 둔다(Q11 결정 후).
- **API**
  - `apps/api/src/modules/billing/`과 `middleware/require-entitlement.ts`를 만들고, AI 라우트 7개에 연결한다.
  - `ErrorCode`에 `subscription_required`를 추가한다.
  - `/internal/*`는 `CRON_SECRET` 헤더로 보호한다.
  - 사용자별 잠금은 메모리가 아니라 DB에서 한다(부분 고유 인덱스와 advisory lock).
  - 해지 취소 경로 이름은 `/api/billing/cancel/undo`로 한다.

## 권장 구현 순서 조정

1. **11/1까지**: Q11·Q12·Q13·Q15를 결정하고 토스 계약을 신청한다(미성년자 대상임을 알린다). 약관·처리방침 개정안을 만든다.
2. **11/16**: Phase 1만 출시한다(`profiles` 확장, `billing_settings`, `getEntitlement`, `requireEntitlement`, `GET /api/billing/status`, 안내 배너). 이때 `open_promo_end_at`은 연장된 값으로 둔다.
3. **design-agent**: 체험 종료, 구독 신청, 마이페이지 구독 관리 Figma 프레임을 먼저 받는다.
4. **Phase 2·3**: 테스트 키로 개발한다. 정기 작업 환경(Q14)을 정한 뒤 Phase 3을 진행한다.
5. **Phase 4 QA와 라이브 소액 결제 검증** 후 `open_promo_end_at`을 확정하고 7일 전에 공지한다.
