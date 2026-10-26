# 가입 동의 게이트 디자인 사전 검토 (design-agent, 2026-10-26)

대상 계획: `.omc/plans/signup-consent.md` (D1~D11 승인본).
이 문서는 구현 전 사전 검토다. 구현 후 같은 항목으로 사후 검수한다(§11).

## 0. 기준과 전제

- **Figma 프레임 없음 (D7).** 가입 동의 게이트(Gate A)와 미성년자 팝업은 Figma에 대응 프레임이 없다. 아래 값은 모두 다음 출처에서만 가져왔다. 새 색상·새 픽셀값은 만들지 않았다.
  - Figma `0. Register/Desktop`(`83:138`), `2. Grade Setup`(`37:30`)
    - 2026-10-26 MCP `get_metadata`와 `get_variable_defs`로 재실측했다.
  - 체크박스: Figma `40:34`/`279:1176`, 코드 `shared/ui/checkbox/Checkbox.tsx`
  - 팝업: Figma `Popup` 섹션 `97:309`, 코드 `shared/ui/modal/Modal.tsx`
  - 텍스트 링크: Figma `203:328`/`203:330`, 코드 `shared/ui/text-link/textLinkStyle.ts`
  - 로그인 링크 행: Figma `203:347`, 코드 `LoginPage`의 `gap-[23px]`
  - 타이포: `docs/DESIGN_SYSTEM.md` §3. 간격은 Tailwind 기본 스케일만 쓴다(`docs/DESIGN_TOKEN_MAP.md` §4).
- **지원 환경.** v1 공식 지원 환경은 iPad 가로 전체화면(폭 1024 이상)이다.
  - 세로 모드와 1024 미만 폭(Split View 포함)에서는 `App.tsx`의 `ViewportGuard` 오버레이가 화면을 덮는다(`docs/FIGMA_SCREEN_MAP.md` "확인된 사항").
  - 게이트도 같은 정책을 따른다. 그래도 레이아웃은 320px 폭까지 깨지지 않는 유동형으로 만든다. 가드 정책이 바뀌어도 그대로 쓸 수 있게 하기 위해서다.
- **Figma 실측 요약**

| 항목 | Register `83:138` | Grade Setup `37:30` | 현재 코드(Register·GradeSetup·Login 공통) |
|---|---|---|---|
| 콘텐츠 열 폭 | 392 | 문구 288, 그리드 532 | `max-w-sm`(384) |
| 폼 요소 사이 간격 | 14 | — | `gap-3`(12) |
| 제목 | Large Title 34/41 Bold | **Title 1 28/34 Bold** | `text-lg font-semibold` (Figma와 다름, §10) |
| 부제 | Callout 16/21 `label/secondary` | Callout 16/21 `label/secondary` | `text-sm` (Figma와 다름, §10) |
| 하단 캡션 | Caption 1 12/16 `label/tertiary` | Footnote 13/18 `label/tertiary` | `text-xs` |
| 입력 행 | `Button/Input` 1행 높이 47, `px 16`, Callout 16/21 | — | `InputGroup` `px-[16px] py-[13px]` |

## 1. `shared/ui/centered-screen/CenteredScreen` (D9)

이 컴포넌트는 기존 Login·Register·GradeSetup 루트 `div`(`bg-bg-primary flex min-h-screen flex-col items-center justify-center gap-6 px-6`)를 공통화한 것이다. 다만 `min-h-screen`을 **`min-h-dvh`로 바꾼다**(frontend.md §3-6).

| 속성 | 값 | 근거 |
|---|---|---|
| 루트 | `bg-bg-primary flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-6 break-keep` | 기존 3개 화면과 같다. `py-6`은 콘텐츠가 뷰포트보다 길 때 위아래 가장자리에 붙지 않게 한다(기본 스케일). `break-keep`은 한글 어절 중간 줄바꿈을 막는다(랜딩 루트와 같은 처리). |
| props | `children: ReactNode`만 받는다 | 폭과 내부 간격은 사용하는 쪽이 정한다. `className` 확장은 3회 이상 반복될 때 추가한다(frontend.md §2). |
| 시맨틱 | `<main>` | 게이트와 화면은 페이지의 주 영역이다. 랜드마크는 하나만 둔다. |

이번 작업에서는 게이트만 이 컴포넌트를 쓴다. Login·Register·GradeSetup 이전은 후속 작업이다(D9).

## 2. 게이트 레이아웃 (`features/auth/SignupConsentGate`)

```
<CenteredScreen>                         gap-6
  ├ 헤더 (flex-col items-center gap-3 text-center)
  │   ├ <Logo size="large"/>               76×76
  │   ├ <h1 tabIndex={-1}> 시작하기 전에 확인해 주세요
  │   └ <p> 수풀잉을 이용하려면 아래 내용에 동의해 주세요   (선택, 제안 문구)
  └ 본문 열 (flex w-full max-w-sm flex-col gap-3)
      ├ <ConsentChecklist/>                §3
      ├ 오류 영역 role="alert"             min-h-5
      ├ <Button variant="primary" type="button"> 동의하고 시작하기
      ├ 보조 링크 행 (flex justify-center gap-[23px])
      │   ├ <button TEXT_LINK_STYLE> 만 14세 미만이에요
      │   └ <button TEXT_LINK_STYLE> 다른 계정으로 로그인
      └ (제출 중) <Spinner label="처리 중"/>   flex justify-center
```

| 요소 | 클래스·토큰 | 근거 |
|---|---|---|
| 제목 `h1` | `text-label-primary text-[28px] leading-[34px] font-bold` | Figma Grade Setup 제목 `Text/Title 1`. 게이트는 학년 선택 바로 앞 단계다. 게이트와 학년 선택이 같은 질문형 화면이라 Title 1을 쓴다. |
| 부제 `p` | `text-label-secondary text-[16px] leading-[21px]` | Figma `Text/Callout`, 양쪽 화면 공통 |
| 본문 열 | `w-full max-w-sm` | 현재 코드 폭과 같다. Figma 392와의 차이는 결정 필요 C-3. |
| 열 내부 간격 | `gap-3` | 현재 폼 간격과 같다. Figma 14와의 차이는 결정 필요 C-3. |
| 오류 영역 | `min-h-5 text-sm`, 문구 `text-accent-orange` | GradeSetup·Register·Login과 같은 패턴. 대비 문제는 C-4. |
| 주 버튼 | `Button variant="primary"` (`w-full`, 50 높이, `disabled:opacity-50`) | Figma `Button/Login`(`83:159`, 392×50) |
| 보조 링크 2개 | `TEXT_LINK_STYLE` + `inline-flex min-h-11 items-center` | 로그인 "Forget" 행(`203:347`, `gap-[23px]`)과 같은 배치다. 둘 다 이동이 아닌 동작이라 `<button type="button">`으로 만든다. `min-h-11`(44pt)은 `ActionMenu`·`SolutionFigures`에 선례가 있다. |

**세로 높이 확인 (iPad 가로 1194×834).** 헤더 약 155, gap 24, 본문 약 284, 합계 약 463이다. 한 화면에 넉넉히 들어가며 스크롤이 생기지 않는다.

**폭별 동작**

| 환경 | 동작 |
|---|---|
| iPad 가로 전체화면(1024 이상) | 정상 표시. 열 폭 384, 수직·수평 가운데 정렬 |
| iPad 세로(820·834 등) | `ViewportGuard` 오버레이("기기를 가로로 돌려주세요")가 덮는다. 아래 레이아웃이 깨지지는 않는다. |
| Split View 1/2·2/3·1/3 | `ViewportGuard`("전체 화면에서 이용해 주세요")가 덮는다. 폭 320에서도 `w-full px-6`이라 가로 스크롤이 생기지 않는다. |
| 키보드 | 게이트에는 입력 필드가 없어 키보드가 올라오지 않는다. |

## 3. 체크리스트 행 (`features/auth/ConsentChecklist`)

### 3.1 컨테이너

- `bg-bg-elevated rounded-[14px]`를 쓴다. 행 사이에는 `<div className="bg-separator h-px"/>`를 넣는다.
  - `InputGroup`(Figma `Button/Input`)과 같은 카드 형태다. 그래서 Register 폼 리듬(흰 카드 3개가 이어지는 모양)에 자연스럽게 맞는다.
- **`overflow-hidden`은 쓰지 않는다.** 행 안 링크와 체크박스의 `ring-offset-2` 포커스 링이 카드 가장자리에서 잘리기 때문이다. 행에는 배경이 없어 `overflow-hidden`이 필요 없다.
- 시맨틱
  - `<fieldset>`으로 감싼다.
  - `<legend className="sr-only">가입 동의 (모두 필수)</legend>`를 둔다.

### 3.2 행 구조

```
<div className="flex items-stretch">                      ← 행
  <label htmlFor={id}
         className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 py-2 pl-4 pr-2">
    <Checkbox id={id} checked onChange disabled={isBusy}/>   24×24
    <span className="text-label-primary text-[16px] leading-[21px]">
      <span className="text-brand font-[590]">(필수)</span> 이용약관에 동의합니다
    </span>
  </label>
  {link ? (
    <a href="/terms.html" target="_blank" rel="noopener noreferrer"
       className={`${TEXT_LINK_STYLE} inline-flex min-h-11 min-w-11 items-center justify-center pl-2 pr-4`}>
      <span className="sr-only">이용약관 </span>보기<span className="sr-only"> (새 탭)</span>
    </a>
  ) : null}
</div>
```

| 항목 | 규칙 |
|---|---|
| 행 높이 | `min-h-11`(44). 라벨이 두 줄이 되면 자동으로 늘어난다(약 58). |
| 라벨 히트 영역 | `<label>` 하나가 체크박스와 문구를 모두 감싼다. 행 왼쪽 끝부터 링크 직전까지가 전부 토글 영역이다. |
| 링크 히트 영역 | 최소 44×44(`min-h-11 min-w-11`). 라벨과 형제 요소로 두어 **겹치지 않는다**. 링크를 `<label>` 안에 넣는 것은 금지한다. 넣으면 링크를 누를 때 체크박스도 함께 토글된다. |
| 나이 행 | 링크가 없다. 라벨이 행 전체 폭(`pr-4`)을 쓴다. |
| 링크 대상 | `/terms.html`, `/privacy.html` (public 이동분, R2) |
| 줄바꿈 | "(필수) 개인정보처리방침에 동의합니다"는 라벨 영역 약 276px에 16px로 넣으면 한계에 걸린다. 그래서 두 줄 표시를 허용한다. `break-keep`은 CenteredScreen에서 상속받는다. Register 안에서 쓸 때는 `ConsentChecklist` 루트에 `break-keep`을 직접 단다. 정렬은 `items-center`이며, 체크박스는 두 줄 문구의 세로 가운데에 온다. |
| "(필수)" 표시 | `text-brand`, Semibold 590. 흰 배경 대비 약 5.2:1이다. `label-secondary`(약 3.4:1)는 AA에 미달해 쓰지 않는다. |

### 3.3 체크박스 상태와 토큰 (기존 컴포넌트 그대로)

| 상태 | 토큰 |
|---|---|
| 미선택 | 보더 `border-stroke-1`, 배경 `bg-bg-elevated`, `rounded-[2px]`(`radius/sm`), 1px |
| 선택 | `checked:bg-brand-rest checked:border-brand-rest`, 체크 아이콘 `stroke-label-on-dark` |
| 포커스 | `focus-visible:ring-2 ring-brand ring-offset-2` (기존) |
| 비활성(제출 중) | **추가 필요.** 아래 Checkbox 변경 참고 |

**`Checkbox` 변경 요청 (기존 MyPage `HistoryRow` 동작은 바꾸지 않는다)**

1. `id?: string`을 추가한다.
2. `aria-label`과 `id` 중 하나는 반드시 받도록 타입을 정한다(discriminated union).
   - 보이는 라벨이 있는 경우에는 `aria-label`을 주지 않는다. 주면 접근 가능한 이름이 보이는 문구를 덮어써 WCAG 2.5.3(Label in Name) 위반이 된다.
3. `disabled?: boolean`을 추가한다. `disabled:cursor-not-allowed disabled:opacity-50`을 적용한다. `Button primary`의 비활성 표현과 같다.
4. `<label>` 안에 들어가도 클릭이 한 번만 토글되는지 테스트한다. 네이티브 input을 직접 탭하는 경우와 문구를 탭하는 경우 둘 다 확인한다.

### 3.4 포커스 순서

1. 나이
2. 약관
3. 약관 보기
4. 개인정보
5. 개인정보 보기
6. 동의하고 시작하기
7. 만 14세 미만이에요
8. 다른 계정으로 로그인

DOM 순서와 같아 `tabIndex` 조정이 필요 없다.

## 4. Register 이메일 폼 안 배치

```
<form className="flex flex-col gap-3" noValidate>
  InputGroup(닉네임)
  InputGroup(이메일·비밀번호)
  <ConsentChecklist/>          ← 신규. 같은 흰 카드라 위 두 카드와 같은 리듬이 된다.
  오류 영역 role="alert"
  <Button type="submit" variant="primary" disabled={isBusy || !allChecked}>이메일로 가입하기</Button>
</form>
<p className="text-label-tertiary text-center text-xs">가입하면 이메일·닉네임·학년과 동의 기록만 수집해요</p>
```

- 간격은 기존 폼 `gap-3`을 그대로 쓴다. 카드 사이에 별도 여백이나 제목을 넣지 않는다.
- 카카오와 Google 가입 버튼 위에는 체크리스트를 두지 않는다. 소셜 가입은 OAuth 복귀 후 게이트(D2)가 동의를 받는다. 같은 체크리스트를 두 번 보여주지 않는다.
- 제출 버튼의 비활성 사유를 따로 문구로 알리지 않는다. 체크리스트가 버튼 바로 위에 있어 사유가 자명하기 때문이다. 스크린리더용 보완은 §7 A-5를 따른다.
- **세로 높이.** 체크리스트를 넣으면 Register 전체 높이가 약 832px이 된다. 그래서 Safari 탭 모드(가시 높이 약 760)에서는 아래 캡션이 첫 화면 아래로 내려간다.
  - 루트가 `min-h`이라 잘리지 않고 스크롤된다. 허용 범위로 본다.
  - 키보드가 올라오면 기존과 같이 스크롤된다.
- 하단 캡션 "가입하면 이메일·닉네임·학년과 동의 기록만 수집해요"
  - 12px 기준 약 270px로, 384px 열에 한 줄로 들어간다. **통과.**
  - 대비 문제(`label-tertiary`)는 §10에 기록했다.

## 5. 미성년자 팝업 (기존 `Modal`, 2버튼)

```
<Modal
  icon="error"
  title="만 14세 미만은 정식 서비스 때 이용할 수 있어요"
  description="보호자 동의 절차를 준비하고 있어요. 지금 만든 계정과 기록은 삭제할 수 있어요."  // 2026-10-27 QA 반영(§12)
  actionLabel="계정 정보 삭제하고 나가기"   // 주 액션
  onAction={leaveAsUnderAge}
  cancelLabel="취소"
  onCancel={close}
/>
```

| 질문 | 판단 |
|---|---|
| 아이콘 | **`icon="error"`** (주황 원 + "!") |
| 이유 | 기존 아이콘은 `check`·`email`·`error` 셋뿐이다. ✓는 성공을 뜻해 맞지 않고, 이메일 아이콘은 무관하다. 아이콘을 생략하면 이메일 아이콘이 기본으로 그려진다. `error`는 `role="alertdialog"`가 된다. 되돌릴 수 없는 동작을 확인하는 대화상자의 올바른 역할이다(WAI-ARIA APG). |
| 파괴적 스타일 여부 | **새 스타일을 만들지 않는다.** `Modal`에는 destructive variant가 없다. 주 액션은 기존 `text-brand-deep`, 취소는 `text-modal-subtitle`이다. `accent-red` 토큰은 있지만 Figma에 파괴적 팝업 디자인이 없다. 그래서 텍스트 버튼에 빨강을 쓰는 것은 결정 필요 C-5로 남긴다. |
| 주 액션 위치 | 왼쪽(기존 2버튼 레이아웃). D11대로 삭제가 주 액션이다. |

**발견된 문제 (구현 전에 정해야 함)**

1. **P1. 초기 포커스가 파괴적 액션에 간다.**
   - 원인: `Modal`은 마운트 시 항상 `actionButtonRef`(삭제)에 포커스를 준다. 키보드 사용자가 Enter나 Space를 한 번 누르면 바로 삭제된다. APG는 파괴적 확인에서 덜 위험한 쪽에 포커스를 두라고 권장한다.
   - 권장: `Modal`에 옵셔널 `initialFocus?: "action" | "cancel"`(기본 `"action"`)을 추가하는 additive 변경. 이 팝업만 `"cancel"`을 쓴다. 기존 사용처는 동작이 바뀌지 않는다.
2. **P1. 삭제 버튼 라벨이 두 줄로 줄바꿈된다.**
   - 원인: 2버튼 레이아웃에서 각 버튼 폭은 약 169px이다(342 − 보더 − 구분선, 나머지 절반). "계정 정보 삭제하고 나가기"는 17px Semibold로 약 200px이다.
   - 결과: 삭제 쪽만 두 줄이 되고 버튼 영역 높이가 52에서 약 74로 늘어난다.
   - 권장: 라벨을 **"삭제하고 나가기"**(약 115px)로 줄인다. 오너가 승인한 카피(D11)를 바꾸는 일이라 결정 필요 C-1로 올린다.
3. **P2. 제목과 설명이 어절 중간에서 줄바꿈될 수 있다.**
   - 원인: 제목은 19px Bold로 약 430px이라 두 줄이 된다. `Modal` `h2`·`p`에 `break-keep`이 없다. 그래서 WebKit이 "이용 / 할 수 있어요"처럼 음절 사이에서 끊을 수 있다.
   - 권장: `Modal`의 `h2`와 `p`에 `break-keep`을 추가한다. 모든 팝업에 적용되며 회귀 위험은 낮다. 기존 Modal 테스트로 확인한다.
4. **P2. 삭제 진행 중 상태가 없다.**
   - 원인: `Modal`에는 버튼 비활성이나 로딩 슬롯이 없다.
   - 권장
     - `leaveAsUnderAge`가 진행 중이면 재호출을 무시한다(훅에서 가드).
     - **실패하면 팝업을 닫는다.** 그다음 게이트 오류 영역에 문구를 띄우고, 포커스를 "만 14세 미만이에요" 링크로 돌려준다. 팝업이 열린 채로는 뒤쪽 오류 영역이 딤(`bg-black/40`)에 가려 보이지 않는다.

## 6. 상태 표

| 상태 | 게이트 | Register 폼 |
|---|---|---|
| 초기 | 세 항목 모두 미선택. 주 버튼 비활성(`opacity-50`) | 제출 버튼 비활성 |
| 일부 선택 | 주 버튼 비활성 유지 | 제출 버튼 비활성 유지 |
| 모두 선택 | 주 버튼 활성 | 다른 비활성 조건(`isBusy`)이 없으면 제출 버튼 활성 |
| 제출 중(loading) | 주 버튼, 체크박스 3개, 보조 링크 2개를 모두 `disabled`로 둔다. 주 버튼에 `aria-busy="true"`를 준다. 아래에 `Spinner label="처리 중"`을 표시한다. | 기존 `isBusy` 흐름과 같다. 체크박스도 `disabled`로 둔다. |
| 오류(저장 실패) | `role="alert"` 영역에 표시. 선택 상태는 유지하고 버튼은 다시 활성화한다. 제안 문구: "동의 내용을 저장하지 못했어요. 다시 시도해 주세요" | 기존 오류 영역 |
| 오류(삭제 실패) | §5-4. 제안 문구: "계정 정보를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요" | — |
| 삭제 409 (이미 동의 기록 있음) | 결정 필요 C-6 | — |
| empty | 해당 없음 | 해당 없음 |
| 성공 | 같은 경로에서 원래 화면을 렌더한다(D2). 별도 성공 팝업은 없다. | 기존 완료·인증 팝업 흐름 |

## 7. 접근성

- **A-1.** 게이트가 마운트되면 `h1`(`tabIndex={-1}`, `outline-none`)로 포커스를 옮긴다.
  - 게이트는 경로 이동 없이 `ProtectedRoute`가 내용을 바꿔치기한다. 그래서 스크린리더가 화면 전환을 인지하지 못하기 때문이다.
- **A-2.** 체크리스트는 `<fieldset>` + sr-only `<legend>`로 묶는다. 각 체크박스의 접근 가능한 이름은 보이는 라벨 전체("(필수) 만 14세 이상입니다")이며, `aria-label`은 쓰지 않는다.
- **A-3.** "보기" 링크의 이름은 "이용약관 보기 (새 탭)"과 "개인정보처리방침 보기 (새 탭)"이다(sr-only 보강, D8). 보이는 "보기"가 이름 안에 포함되어 2.5.3을 충족한다.
- **A-4.** 포커스 링 토큰은 다음과 같다. 새 링은 만들지 않는다.
  - 체크박스와 버튼: `ring-2 ring-brand ring-offset-2`
  - 링크: `TEXT_LINK_FOCUS_RING`
- **A-5.** 비활성 주 버튼은 포커스를 받지 못한다. 그래서 `fieldset` 바로 뒤나 버튼에 `aria-describedby`로 sr-only 안내를 연결한다. 안내 문구는 "세 항목에 모두 동의하면 시작할 수 있어요"이다. 게이트와 Register에 공통이다.
- **A-6.** 터치 타깃: 행, 링크, 보조 링크 모두 44pt 이상이다.
- **A-7.** 오류 영역은 기존 패턴(`role="alert"` + `aria-live="polite"`)을 쓴다.
  - `alert`는 원래 assertive라 두 속성이 충돌한다. 앱 전체에 퍼진 패턴이라 이번에는 그대로 둔다(§10).

## 8. 카피 검토

| 위치 | 새 문구 | 판정 |
|---|---|---|
| RegisterPage 캡션 | 가입하면 이메일·닉네임·학년과 동의 기록만 수집해요 | 12px로 약 270px이고 열 폭은 384다. 한 줄로 들어가 **통과**. |
| 랜딩 CtaSection 2번째 줄 | 이메일·닉네임·학년과 동의 기록만 받아요. | 아래 폭 계산 참고 |

랜딩 CtaSection 폭 계산.
- 앞 문장 뒤의 명시적 `<br/>` 다음 줄이다. 본문은 `Landing/Body L`(md 이상 17/1.65, 기본 16)이다.

| 폭 | 왼쪽 열 폭 | 문구 폭 | 결과 |
|---|---|---|---|
| lg(1024 이상) | 약 486(1180 − px-6×2 − p-16×2 − gap 32, 그 절반) | 약 340 | 한 줄 |
| md(768~1023) | 약 880 | — | 한 줄 |
| 폰(375) | 약 279 | 약 320 | 두 줄. 랜딩 루트에 `break-keep`이 있어 "…동의 기록만 / 받아요."처럼 어절 단위로 끊긴다. 같은 문단의 첫 줄도 폰에서 이미 여러 줄로 감기므로 시각적 이상은 없다. |

- 판정: Figma CTA 레이아웃(2열, 왼쪽 열 flex 1)에 **들어간다. 문구를 바꿀 필요는 없다.**
- 폰에서도 한 줄로 유지하고 싶다면 대안은 "이메일·닉네임·학년, 동의 기록만 받아요."이다. 큰 차이는 없어 권장하지 않는다.
- Figma `447:131` 본문 텍스트와 `docs/LANDING_DESIGN.md` §3.7(306행)의 원문은 아직 "학년만 받아요"다. 오너가 Figma 텍스트를 갱신해야 하며(C-7), 문서는 개발 단계에서 함께 고친다.

## 9. 결정 필요

| ID | 항목 | design-agent 권장 |
|---|---|---|
| C-1 | 팝업 삭제 버튼 라벨이 2줄로 감김(§5-2) | "삭제하고 나가기"로 단축 |
| C-2 | 게이트 부제 문구 사용 여부 | "수풀잉을 이용하려면 아래 내용에 동의해 주세요" 사용 |
| C-3 | 열 폭 384(`max-w-sm`)와 Figma 392, 간격 12와 Figma 14의 차이 | 기존 3개 화면과 같은 `max-w-sm`과 `gap-3`을 유지한다. CenteredScreen 이전 작업 때 Figma 값 반영 여부를 함께 정한다. |
| C-4 | 오류 문구 대비 | `accent-orange` 문구는 `bg-primary` 위에서 약 1.9:1로 AA 미달이다. 앱 공용 오류 텍스트 토큰이 필요하다. 오너가 Figma 값을 정해야 하며 임의로 지정하지 않는다. |
| C-5 | 파괴적 액션의 색상 표현 | 이번에는 기존 `text-brand-deep`을 쓴다. Figma에 destructive 팝업이 생기면 교체한다. |
| C-6 | 삭제 409(다른 탭에서 이미 동의함) 시 처리 | 팝업을 닫고 게이트를 다시 확인한다(`USER_UPDATED`). 문구는 "이미 동의가 완료된 계정이에요"로 하고 화면은 그대로 진행한다. |
| C-7 | Figma `447:131` CTA 본문과 Register `83:160` 캡션 텍스트 갱신 | 오너가 Figma를 수정한다. 코드는 승인된 D1 카피를 따른다. |
| C-8 | 게이트와 미성년자 팝업의 정식 Figma 프레임 | 프레임이 추가되면 사후 재검수한다(`docs/FIGMA_SCREEN_MAP.md`에 "프레임 없음, 임시" 기록). |

## 10. 기존 화면에서 발견한 문제 (이번 범위 밖, 우선순위 순)

| 우선 | 파일 | 원인 | 권장 수정 |
|---|---|---|---|
| P1 | `shared/ui/modal/Modal.tsx` | 초기 포커스가 항상 주 액션에 가고, 파괴적 확인에도 같은 동작을 한다. | `initialFocus` prop 추가(§5-1). 이번 작업에 포함하는 것을 권장한다. |
| P2 | `pages/register/RegisterPage.tsx`, `pages/login/LoginPage.tsx`, `pages/grade-setup/GradeSetupPage.tsx`, `features/auth/ProtectedRoute.tsx` | `min-h-screen` 사용(frontend.md §3-6 위반) | CenteredScreen으로 이전한다(D9 후속). ProtectedRoute 로딩 화면도 `min-h-dvh`로 바꾼다. |
| P2 | 같은 3개 페이지 | 제목 `text-lg font-semibold`와 부제 `text-sm`이 Figma(Title 1 또는 Large Title, Callout)와 다르다. | 이전 작업 때 Figma 타이포로 맞춘다. 게이트는 처음부터 Figma 값을 쓴다. |
| P2 | `shared/ui/modal/Modal.tsx` | 한글 줄바꿈 처리(`break-keep`)가 없다. | `h2`와 `p`에 `break-keep`을 추가한다. |
| P2 | `pages/login/LoginPage.tsx` | 텍스트 링크 높이가 20px로 44pt에 미달한다. | `inline-flex min-h-11 items-center`를 추가한다. |
| P3 | Register 캡션, 각 화면 부제 | `label-tertiary`와 `label-secondary`가 `bg-primary` 위에서 AA 미달이다(약 1.9:1, 3.2:1). | 오너가 토큰을 정한다(C-4와 함께). |
| P3 | 공통 오류 영역 | `role="alert"`와 `aria-live="polite"`가 충돌한다. | `role="status"`(polite) 또는 `role="alert"` 단독 중 하나로 통일한다. |

## 11. 사후 검수 체크리스트

- [ ] 게이트 루트가 `CenteredScreen`(`min-h-dvh`)이고, 임의 색상과 새 픽셀값이 없다.
- [ ] 제목은 Title 1 28/34 Bold, 부제는 Callout 16/21 `label-secondary`다.
- [ ] 체크리스트 카드는 `bg-bg-elevated rounded-[14px]` + `bg-separator` 구분선이고, `overflow-hidden`이 없다.
- [ ] 행과 링크가 모두 44pt 이상이고 서로 겹치지 않는다. 링크를 눌러도 토글되지 않는다.
- [ ] `Checkbox`의 `id`·`disabled` 추가가 additive이고, MyPage `HistoryRow` 스냅샷이나 동작에 회귀가 없다.
- [ ] 링크는 `target="_blank" rel="noopener noreferrer"`이고, sr-only로 "(항목) 보기 (새 탭)"이 붙어 있다.
- [ ] 제출 중에는 모든 컨트롤이 비활성이고 Spinner가 보인다. 오류는 `role="alert"`로 표시된다.
- [ ] 팝업은 `icon="error"`, 2버튼이며, C-1과 §5-1 결정이 반영되어 있다.
- [ ] 삭제가 실패하면 팝업을 닫고 오류를 표시한 뒤 포커스를 복귀시킨다.
- [ ] Register에서 체크리스트가 비밀번호 카드와 제출 버튼 사이에 있고, 모두 선택하기 전에는 제출할 수 없다.
- [ ] 카피 2곳이 바뀌어 있다(RegisterPage, CtaSection). `docs/LANDING_DESIGN.md` §3.7도 함께 갱신되어 있다.
- [ ] 1194×834 가로에서 스크롤 없이 표시된다. 세로와 Split View에서는 `ViewportGuard`가 덮는다. 320 폭에서 가로 스크롤이 없다.

## 12. 구현 반영 결정 (오케스트레이터, 2026-10-26)

§9 결정 필요 항목과 §5 문제의 처리 결과다. 구현은 이 표를 따른다.

| ID | 처리 | 구현 |
|---|---|---|
| C-1 | 확정. 삭제 버튼 라벨을 **"삭제하고 나가기"**로 줄인다(D11 카피 단축). | `SignupConsentGate` 미성년자 팝업 `actionLabel` |
| C-2 | 확정. 부제 "수풀잉을 이용하려면 아래 내용에 동의해 주세요"를 쓴다. | 게이트 헤더 `p` |
| C-3 | 확정. 현재 열 폭 384(`max-w-sm`)와 간격 12(`gap-3`)를 유지한다. Figma 392/14 반영 여부는 CenteredScreen 이전 작업 때 다시 본다. | 게이트·Register 본문 열 |
| C-4 | **결정 필요(유지).** 기존 `text-accent-orange` 오류 문구를 그대로 쓴다. 앱 공용 오류 텍스트 토큰은 오너가 Figma 값을 정한 뒤 반영한다. | 오류 영역 |
| C-5 | **결정 필요(유지).** 파괴적 주 액션은 기존 `text-brand-deep`을 쓴다. Figma에 destructive 팝업이 생기면 교체한다. | `Modal` 주 액션 |
| C-6 | 확정. 삭제 요청이 409면 팝업을 닫고 게이트 오류 영역에 "이미 동의가 완료된 계정이에요"를 표시한다. 로그아웃하지 않는다. 포커스는 "만 14세 미만이에요"로 돌려준다. | `useSignupConsent.leaveAsUnderAge` |
| C-7 | **오너 후속.** Figma `447:131` CTA 본문과 Register `83:160` 캡션 텍스트를 "…학년과 동의 기록만…"으로 갱신한다. 코드와 `docs/LANDING_DESIGN.md` §3.7은 갱신했다. | — |
| C-8 | **오너 후속.** 게이트와 미성년자 팝업의 정식 Figma 프레임. 생기면 사후 재검수한다(`docs/FIGMA_SCREEN_MAP.md` "프레임 없음, 임시" 기록). | — |
| §5 P1 초기 포커스 | 확정. `Modal`에 옵셔널 `initialFocus?: "action" \| "cancel"`(기본 `"action"` = 기존 동작)을 추가했다. 미성년자 팝업만 `"cancel"`. | `shared/ui/modal/Modal` |
| §5 P2 줄바꿈 | 확정. `Modal` `h2`·`p`에 `break-keep`을 추가했다. `Modal.test.tsx`의 className 기준값은 이 클래스 하나만 반영해 갱신했다. | `shared/ui/modal/Modal` |
| §5 P2 삭제 진행 | 확정. 진행 중 재호출은 훅에서 무시한다(ref 가드). 실패하면 팝업을 닫고 게이트 오류 영역에 표시하며, 포커스를 "만 14세 미만이에요"로 돌려준다. | `useSignupConsent`, `SignupConsentGate` |
| §7 A-1·A-5 | 확정. 게이트 마운트 시 `h1`(`tabIndex=-1`)로 포커스. 비활성 사유 sr-only 안내 "세 항목에 모두 동의하면 시작할 수 있어요"를 `aria-describedby`로 연결(게이트·Register 공통, 세 항목을 모두 고르면 연결을 뗀다). | `ConsentChecklist` `hintId` |
| QA LOW 문구 (2026-10-27) | 확정. 미성년자 팝업 설명을 "지금 만든 계정과 기록은 삭제할 수 있어요."로 바꾼다. 서버가 학습 기록까지 FK cascade로 지우므로 PRD·방침의 "계정과 학습 기록"과 맞춘다. | `SignupConsentGate` 팝업 `description` |
| 동의 판정 일치 (2026-10-27) | 확정. 서버 409 판정을 웹과 같은 규칙(세 동의 일시가 모두 비어 있지 않은 문자열)으로 맞추고, 규칙을 `packages/validation`의 `hasSignupConsentMetadata`로 공유한다. 정책 버전만 있거나 빈 문자열이 있는 계정은 미동의로 보고 삭제를 허용한다. 게이트가 보이는 사용자는 항상 삭제할 수 있다. | `validation/src/signupConsent.ts`, `account.router.ts`, `features/auth/signupConsent.ts` |
| §13.4 P3 커서 (2026-10-27) | 확정. 체크박스가 비활성이면 행 `<label>`도 `cursor-not-allowed`. | `ConsentChecklist` |

**이번 범위 밖(후속):** §10의 기존 화면 `min-h-screen` → `CenteredScreen`/`min-h-dvh` 이전(Login·Register·GradeSetup·ProtectedRoute 로딩 화면), 타이포 Figma 정렬, 로그인 텍스트 링크 44pt, `label-tertiary`/`label-secondary` 대비(C-4와 함께), 오류 영역 `role="alert"` + `aria-live="polite"` 충돌.

## 13. 사후 검수 결과 (design-agent, 2026-10-27)

**판정: PASS.** 막는 문제는 없다. 아래 P3 3건은 후속으로 처리해도 된다.

### 13.1 방법

- 실제 미동의 로그인 환경이 없어서 저장소 밖(scratchpad)에 일회용 하네스를 만들었다.
  - 렌더 대상: 실제 `SignupConsentGate`, `RegisterPage`, `ViewportGuard`
  - mock: supabase client, `useAuth`, `useAuthActions`, `deleteUnconsentedAccount`. mock은 저장 실패와 삭제 실패 응답을 600ms 지연 후 돌려준다.
- 하네스는 Vite 5199 포트로 띄웠고 검수 후 종료했다.
- 브라우저: Playwright headless Chromium과 WebKit.
- 측정 크기: 1194×834, 1180×820, 820×1180, 375×812.
- 제품 코드는 수정하지 않았다. typecheck, lint, test, build는 이번 검수에서 실행하지 않았다(개발 단계 게이트에서 실행).

### 13.2 실측 (Chromium 기준, WebKit도 같은 값)

| 항목 | 결과 |
|---|---|
| 게이트 루트 | `<main>`, `min-h-dvh`(1194×834에서 834) |
| 스크롤 | 1194×834와 1180×820 모두 문서 높이가 뷰포트와 같아 스크롤이 없다. 320~375 폭에서도 가로 스크롤이 없다. |
| 제목 | 28px/34px/700 (Title 1) |
| 체크리스트 | 카드 384×134. 행은 44 높이 3개 + 구분선 2개 |
| 라벨 히트 영역 | 나이 행 384×44, 약관·개인정보 행 334×44 |
| 링크 히트 영역 | 50×44. 라벨 오른쪽 끝(x 739)에서 바로 시작해 겹침이 없다. 링크를 클릭해도 토글되지 않고, 라벨 문구를 클릭하면 토글된다. |
| 보조 링크 | "만 14세 미만이에요" 113×44, "다른 계정으로 로그인" 125×44 |
| 820×1180, 375×812 | `ViewportGuard` 오버레이가 표시된다(예상대로). 오버레이를 걷어낸 375 화면에서는 개인정보 행만 두 줄("개인정보처리방침에 / 동의합니다", 어절 단위)이고, 행과 링크가 58로 늘어난다. 레이아웃은 깨지지 않는다. |
| Register(1194×834) | 체크리스트가 비밀번호 카드와 제출 버튼 사이에 있다. 간격 12로 기존 폼 리듬과 같다. 문서 높이는 848이라 하단 캡션이 14px 넘친다. 루트가 `min-h`이라 잘리지 않고 스크롤된다(§4에서 예상한 범위). 캡션은 한 줄이다. |
| 접근 가능한 이름 | 그룹 "가입 동의 (모두 필수)". 체크박스 이름은 보이는 라벨 전체이며 `aria-label`이 없다. 링크 이름은 "이용약관 보기 (새 탭)", "개인정보처리방침 보기 (새 탭)"이고 `target=_blank`, `rel="noopener noreferrer"`가 있다. |
| 비활성 사유 안내 | 미완료 상태에서 주 버튼과 Register 제출 버튼 모두 `aria-describedby`가 sr-only 안내를 가리킨다. |
| 마운트 시 포커스 | 게이트 `h1`("시작하기 전에 확인해 주세요") |
| Tab 순서(Chromium) | 나이 → 약관 → 약관 보기 → 개인정보 → 개인정보 보기 → (비활성 주 버튼은 건너뜀) → 만 14세 미만이에요 → 다른 계정으로 로그인. §3.4와 일치한다. |
| 포커스 링 | 모든 컨트롤에 `:focus-visible`이 적용된다. 흰 2px 오프셋 + `brand`(#5e6e82) 2px 링이다. 카드 안 링크 링도 잘리지 않는다(`overflow-hidden` 없음 확인). |
| 미성년자 팝업 | `alertdialog`, 초기 포커스는 **취소**, 폭 342. "삭제하고 나가기"와 "취소" 모두 170×56 한 줄이다(C-1 반영으로 줄바꿈 해소). 제목은 2줄 "만 14세 미만은 정식 서비스 때 이용할 / 수 있어요", 설명은 2줄. 둘 다 어절 단위로 끊긴다(`break-keep` 반영). |
| 취소 Enter | 팝업이 닫히고 포커스가 "만 14세 미만이에요"로 돌아온다. |
| 삭제 실패 | 삭제 버튼을 연속 2회 눌러도 요청은 1회 진행된다(ref 가드). 실패하면 팝업이 닫히고 오류 영역에 "계정 정보를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요"가 표시되며 포커스가 돌아온다. |
| 제출 중 | 체크박스 3개가 `disabled`, 주 버튼이 `aria-busy`이고 Spinner가 표시된다. |
| 저장 실패 | 오류 문구가 표시되고 체크 3개가 유지되며 버튼이 다시 활성화된다. |
| 콘솔 오류 | 0 |

### 13.3 §11 체크리스트

| 항목 | 결과 |
|---|---|
| CenteredScreen(`min-h-dvh`), 임의 색상과 새 픽셀값 없음 | 통과. 새 리터럴은 §2와 §3에 명시한 Figma와 기존 값(`text-[28px]`, `text-[16px]`, `rounded-[14px]`, `gap-[23px]`)뿐이다. |
| 제목 Title 1, 부제 Callout `label-secondary` | 통과 |
| 체크리스트 카드 토큰, `overflow-hidden` 없음 | 통과 |
| 행과 링크 44pt 이상, 겹침 없음, 링크로 토글 안 됨 | 통과 |
| Checkbox `id`·`disabled`가 additive이고 HistoryRow 회귀 없음 | 통과(코드 검토와 단위 테스트 기준값 확인). discriminated union으로 `aria-label`과 `id` 중 하나를 강제한다. |
| 링크 `target`·`rel`·sr-only | 통과 |
| 제출 중 비활성, Spinner, `role=alert` 오류 | 통과 |
| 팝업 `icon="error"`, 2버튼, C-1과 P1 반영 | 통과 |
| 삭제 실패 시 닫기, 오류 표시, 포커스 복귀 | 통과 |
| Register 배치와 제출 잠금 | 통과 |
| 카피 2곳과 `LANDING_DESIGN.md` §3.7 | 통과(diff 확인) |
| 1194×834 스크롤 없음, 세로와 Split View는 가드, 320 폭 가로 스크롤 없음 | 통과 |

### 13.4 남은 사항 (막지 않음)

| 우선 | 파일 | 원인 | 권장 |
|---|---|---|---|
| P3 | `features/auth/ConsentChecklist.tsx` | 제출 중 체크박스가 `disabled`여도 `<label>`에 `cursor-pointer`가 남는다. | 비활성일 때 `cursor-not-allowed`로 바꾼다. 마우스와 트랙패드에서만 보이는 차이다. |
| P3 | `features/auth/SignupConsentGate.tsx` | 삭제 진행 중 진행 표시(Spinner)가 팝업 딤 뒤에 렌더되어 보이지 않는다. 600ms 동안 팝업 버튼에 아무 변화가 없다. | `Modal`에 진행 상태 슬롯이 생길 때 반영한다(기존 Modal 한계, §5-4). |
| P3 | 미성년자 팝업 제목 | 두 번째 줄이 "수 있어요" 한 어절만 남아 균형이 약하다. | 원하면 Modal `h2`에 `text-wrap: balance`(Tailwind `text-balance`)를 추가한다. 모든 팝업에 적용되므로 오너 판단에 맡긴다. |
| 기록 | WebKit Tab 순서 | Playwright WebKit에서는 Tab이 체크박스와 링크를 건너뛰었다. macOS와 iPadOS의 "전체 키보드 접근" 설정이 꺼진 기본값 때문이며 제품 결함이 아니다. Chromium에서 순서를 확인했다. | — |
| 유지 | C-4, C-5, C-7, C-8과 §10 | 결정 대기나 후속 작업. 오류 문구(`accent-orange`)의 낮은 대비는 화면에서도 확인됐다. | §12 그대로 |

## 14. Stage QA (stage-qa-agent, 2026-10-27)

**1차 판정(2026-10-27): STAGE CONDITIONAL PASS — FIX REQUIRED. 재검증 최종 판정: STAGE PASS — READY FOR NEXT STAGE(§14.10).** 1차 내용 — 제품 코드 결함(BLOCKER·HIGH)은 찾지 못했다. AUTH-11·AUTH-4의 수용 기준은 모두 실행 증거로 통과했다. 다음 단계로 넘기기 전에 아래 "필수 수정" 3건(테스트 1, 문서 2)을 처리한다. QA는 제품 파일을 수정하지 않았다(변이 시험 전후 `git diff`와 미추적 파일 해시가 동일, 이 절만 추가).

### 14.1 게이트 (저장소 루트, 첫 실행, load 14~16)

| 게이트 | 결과 |
|---|---|
| typecheck | 0 |
| lint | 0 |
| test | 0 — api 72 파일 / 1,052, web 130 파일 / 1,400 (실패 0) |
| build | 0 — precache 11개, `privacy.html`·`terms.html`은 precache에 없음 |

`docs/FIGURES_WORKFLOW_STATE.md` §7.18.4 플레이크 예외는 적용하지 않았다(실패가 없었다). 변이 시험 뒤 복원한 트리에서 관련 13개 파일(140)과 `modules/account`(7)을 다시 돌려 통과를 확인했다.

### 14.2 요구사항

| ID | 판정 | 증거 |
|---|---|---|
| AUTH-11 세 항목 선택 전 버튼 비활성 | PASS | 게이트·Register 모두 브라우저에서 0/3, 2/3 비활성, 3/3 활성. 변이 S1·S3·S4 사망 |
| AUTH-11 미동의 사용자는 어느 보호 URL이든 같은 경로에서 게이트 | PASS | 실제 빌드 + 실제 supabase-js + 가짜 GoTrue로 신규(학년 없음)·기존(학년 있음) 두 사용자가 `/`, `/grade-setup`, `/solve/pencilcanvas`, `/solve/landscape`, `/camera`, `/camera/preview`, `/mypage` 14경우 모두 게이트. 보호 화면 문구 유출 0, 단순 방문으로 `user_metadata` 변경 0 |
| AUTH-11 동의 후 원래 화면, 새로고침 뒤에도 유지 | PASS | `/solve/pencilcanvas`에서 동의 → 같은 경로에서 "문제 인식하기". PUT /user 정확히 1회. 서버 메타데이터에 4키 + 기존 grade·nickname 보존. 새로고침 후 게이트 없음 |
| AUTH-11 동의 완료 사용자는 게이트를 다시 보지 않음, 마이페이지 → `/grade-setup` | PASS | 브라우저 확인. 학년 선택 후에도 동의 키 유지 |
| AUTH-11 이메일 가입은 `/register` 폼에서 수집 | PASS | 제출 본문 `data`에 nickname + 4키(같은 ISO 시각, 버전 2026-10-26). 변이 E1·E2 사망 |
| AUTH-11 미성년자 삭제 → 계정 삭제, 로컬 로그아웃, `/login` | PASS | 서버에서 해당 계정만 제거, 로컬 세션 null, `/login`, 재방문 `/mypage`는 `/login`. 이중 클릭 시 DELETE 1회. 변이 D1~D4·D6·F1·F4 사망 |
| AUTH-11 동의 기록 있는 계정은 서버가 409 | PASS | 실제 HTTP 확인(§14.3). 다른 탭에서 동의한 경우 화면은 팝업을 닫고 "이미 동의가 완료된 계정이에요", 계정·세션 유지 |
| AUTH-11 약관·방침 "보기" 링크 | PASS | 새 탭, 200 `text/html`, 링크 클릭으로 체크 토글 없음 |
| AUTH-4 수집 안내 문구(Register·랜딩) | PASS | 코드·테스트·LANDING_DESIGN §3.7 일치. 오래된 "학년만" 잔존은 Figma(C-7, 오너 후속)뿐 |
| 법적 문서 내용 ↔ 14+ 베타 정책 ↔ 게이트 문구 | PARTIAL | 아래 M-2 |

### 14.3 `DELETE /api/account/unconsented` 보안 (실제 `createApp` + 실제 supabase-js → QA 가짜 GoTrue, HTTP)

| 시나리오 | 결과 |
|---|---|
| 토큰 없음 / 쓰레기 토큰 | 401 `unauthorized` |
| 동의 계정 | 409 `conflict`, 삭제 호출 0 |
| 동의 계정 + 피해자 id를 query·header·body로 전송(IDOR) | 3회 모두 409, 피해자 유지 |
| 미동의 공격자 + 피해자 id를 query·header·body로 전송 | 204, 삭제된 것은 토큰 소유자뿐. 피해자·동의 계정 유지 |
| 삭제된 계정의 토큰으로 재호출 | 401 |
| 관리 API 장애(원문 `secret detail…`) | 500 `계정 정보를 확인하지 못했습니다.`, 원문 미노출 |
| GET·POST | 404 |
| CORS 사전 요청 | DELETE·authorization 허용 |
| 속도 제한(`RATE_LIMIT_MAX=3`) | 409, 409, 409, 429 |

- 서버는 토큰 사용자 id로 `admin.getUserById`를 다시 읽고 동의 키가 하나라도 있으면 409, 없을 때만 `deleteUser`를 호출한다. 클라이언트가 보낸 상태는 쓰지 않는다. 변이 A1(409 비활성), A4(재조회 생략), A5(인증 제거), A8, A9(원문 노출), A13, A15는 사망했다.
- **동의 계정이 이 엔드포인트로 지워지는 경로는 없다.** 단 본인이 `updateUser`로 자기 동의 키를 지운 뒤 호출하는 자가 삭제는 가능하다. D3에서 수용한 범위다.
- 잔여(수용, D6): API 라우트는 동의 여부를 검사하지 않는다. 직접 호출하는 미동의 사용자는 막히지 않고, Supabase를 직접 호출한 가입은 동의 없이 만들어질 수 있다.

### 14.4 우회·회귀

- 비밀번호 재설정 세션(해시 `type=recovery`): 미동의·동의 두 계정 모두 `/` → `/login`에서 게이트 없이 재설정 흐름 유지. 같은 세션으로 보호 경로에 SPA 이동하면 미동의는 게이트, 동의는 마이페이지.
- 이메일 로그인(UI): 동의 계정은 `/solve/pencilcanvas`에서 게이트 없음, 학년 있는 미동의 계정은 같은 경로에서 게이트, 학년 없는 미동의 계정은 `/grade-setup`에서 게이트. 로그아웃 상태의 보호 경로는 `/login`으로 가고 게이트가 남지 않는다.
- `PublicOnlyRoute`·`IndexRedirect`·`postAuthDestination`·`ViewportGuard`는 diff에 없다(무변경 확인).
- Modal: 기본 초기 포커스는 주 액션 그대로(2버튼·1버튼 테스트). 다른 모달에서 바뀐 것은 `h2`·`p`의 `break-keep` 클래스뿐이다(기존 className 단언 갱신, 줄바꿈 위치가 달라질 수 있음).
- Checkbox: `disabled`·`id` 추가는 additive. `disabled` 미지정 시 래퍼 클래스가 기존과 문자열 동일(테스트). HistoryRow(`aria-label`)는 타입 유니온으로 그대로 허용되고 테스트 통과.
- R1(`createFakeSession` 기본 동의): `createFakeSession` 사용 테스트 22개 파일, `useAuth`를 직접 mock하는 테스트 0개. 이번 변경 전에 미동의 상태를 의도한 테스트는 없었다. 미동의가 필요한 곳은 `createUnconsentedSession`을 쓰는 파일 2개(통합·게이트)다. 가려진 실패는 찾지 못했다. 주의: `createFakeSession({ user_metadata: {} })`는 여전히 동의 상태다(JSDoc에 명시).

### 14.5 변이 시험 (총 58개, 모두 원복, 전후 `git diff` 바이트 동일)

사망 41, 생존 17. 생존의 분류:

| ID | 변이 | 분류 |
|---|---|---|
| A2·A3·A10 | 서버가 사용자 id를 헤더·쿼리·본문에서 먼저 읽음 | **테스트 공백(M-1).** 현재 코드는 안전(§14.3 실측). 이 불변식을 고정하는 테스트가 없다 |
| A6·A14 | 속도 제한 제거·인증 앞으로 이동 | 테스트 공백(LOW). 현재 코드는 429 실측 |
| A7·A12 | 정책 버전 키만 있는 계정 409, 409 메시지 문구 | 테스트 공백(LOW) |
| P2 | `consentedUserId`를 사용자 id와 비교하지 않음 | 테스트 공백(LOW, 같은 마운트에서 계정 전환 시에만 관련) |
| P3 | 비로그인에서 `return null` 제거(게이트가 잠깐 보임) | 테스트 공백(LOW). 최종 상태는 같아서 기존 테스트가 못 잡음 |
| F3 | 삭제 중 취소 닫기 방지 제거 | 테스트 공백(LOW). 브라우저에서는 삭제 중 취소가 무시됨을 확인 |
| D5 | `navigate("/login")`의 `replace` 제거 | 테스트 공백(LOW) |
| F2·S2·S5 | 제출 중복 가드·훅/폼의 완료 가드 제거 | 방어층 중복(버튼이 이미 비활성). 조치 불필요 |
| U5·E3·A11 | 오류 무시, 키 순서, 재조회 오류 무시 | 동치 또는 다른 층이 흡수. 조치 불필요 |

요청한 항목별: `hasSignupConsent`(H1~H5 사망), ProtectedRoute 게이트 삽입(P1·P4 사망), `updateUser` 페이로드(U1~U4 사망), 미성년자 삭제 경로(D1~D4·D6·D7 사망), 진행 중 가드(삭제 F1·F4 사망, 제출 F2·취소 F3 생존), 409 메시지(웹 C1·C2 사망, 서버 문구 A12 생존), `initialFocus`(I1~I3 사망), 이메일 가입 `options.data`(E1·E2 사망), 서버 409·토큰 id(A1·A4 사망, A2·A3·A10 생존), 세 항목 전 제출 비활성(S1·S3·S4 사망, S2·S5 중복 방어).

### 14.6 빌드 산출물·법적 페이지

- `dist/privacy.html`, `dist/terms.html`은 `public/` 원본과 바이트 동일(`cmp`). `sw.js` precache 11개에 없고 `navigateFallbackDenylist`에 `/(home|privacy|terms).html`이 있다. 서비스 워커의 런타임 동작은 이번에 실행하지 않았다(설정 검사만).
- 랜딩 청크 `home-*.js`에 `/privacy.html`, `/terms.html` 링크가 있다. 정적 서버에서 두 경로 모두 200 `text/html`. `docs/legal`은 비어 있다.
- 내용: 시행일 2026-10-26, 버전 1.0이 `CONSENT_POLICY_VERSION`과 일치한다. 이용약관 제4조·방침 §3은 "베타는 만 14세 이상, 미만이 확인되면 삭제, 보호자 동의 절차는 정식 전환 시 도입"으로 게이트 팝업 문구와 일치한다.

### 14.7 이슈

- **MEDIUM**
  - **M-1 (필수 수정, 테스트).** `account.router.test.ts`에 "사용자 id는 토큰에서만 온다" 테스트가 없다. 헤더·쿼리·본문에 다른 id를 실어 보내도 `getUserById`·`deleteUser`가 토큰 사용자 id로만 호출되는지 확인한다. 속도 제한 429 한 건도 함께 추가하는 것을 권장한다.
  - **M-2 (필수 수정, 오너 결정·문서).** `privacy.html` §3은 "만 14세 미만 아동의 개인정보는 수집하지 않습니다"라고 쓰지만, 소셜 가입은 나이 확인 전에 계정(이메일·이름·소셜 식별자)이 이미 만들어진다. 같은 절 다음 줄의 "확인되면 삭제"와 게이트가 이를 처리하므로 실제 동작은 정책과 맞지만 첫 문장이 사실과 다르다. "가입 시 나이를 확인하며, 만 14세 미만으로 확인되면 즉시 삭제한다"처럼 고치거나 오너가 현 문구를 확정한다. 방침 §1 표에는 정책 버전(`consent_policy_version`)이 빠져 있다.
  - **M-3 (필수 수정, 문서).** PRD §4.1의 AUTH-9와 AUTH-10 사이 빈 줄(약 119행, HEAD 이전부터 있던 표 끊김) 때문에 AUTH-10과 새 P0 AUTH-11이 표 밖이다. 빈 줄을 지우면 해결된다.
- **LOW**
  - 속도 제한·정책 버전 단독 키·409 문구·P2·P3·F3·D5 테스트 공백(§14.5).
  - `useSignupConsent`의 주석 "서버 세션 무효화 요청 없이"는 사실과 다르다. supabase-js `signOut({scope:"local"})`도 `POST /logout?scope=local`을 보낸다(404·401·403은 무시하고 로컬 세션을 항상 제거). 동작은 안전하다.
  - 서버 판정(키 하나라도 있으면 409)과 웹 판정(세 키 모두 비어 있지 않은 문자열)이 다르다. 본인이 메타데이터를 직접 `""` 등으로 만든 경우에만 발생하며, 게이트가 보이는데 삭제는 "이미 동의가 완료된 계정이에요"로 거부된다.
  - 미성년자 팝업 문구는 "계정 정보"만 말하지만 서버는 학습 기록까지 FK cascade로 삭제한다(PRD·방침은 "계정과 학습 기록"). 학습 이력이 있는 기존 사용자에게 오너가 문구를 보강할지 결정한다.
  - `docs/FIGMA_SCREEN_MAP.md` 전체가 CRLF → LF로 바뀌어 diff가 108줄이고 끝 개행이 없다. 실제 내용 변경은 2행이다.
  - `Modal`의 `eslint-disable-next-line react-hooks/exhaustive-deps`(마운트 1회 포커스, 사유 주석 있음).
  - design-agent §13.4의 P3 3건은 그대로 남아 있다.

### 14.8 검증하지 못한 항목

- **NOT VERIFIED — PHYSICAL DEVICE TEST REQUIRED:** 실제 iPad Safari·설치형 PWA(새 탭 링크, 소프트웨어 키보드, 방향 전환), Apple Pencil.
- 실제 Supabase(GoTrue의 `updateUser` 병합, `admin.deleteUser` + FK cascade, RLS)와 실제 카카오·구글 OAuth 신규 사용자 흐름. 이번에는 실제 supabase-js SDK를 QA 가짜 GoTrue(포트 5198)에 연결해 검증했다.
- Render 운영 호스트의 `/privacy.html`·`/terms.html` 응답(정적 서버로 에뮬레이션만).
- 서비스 워커 런타임에서 두 문서가 네트워크로 가는지(설정·precache 목록만 확인).

### 14.9 필수 수정 (다음 단계 전)

1. M-1: 서버 라우터 테스트에 id 출처 고정 + 429 추가 (재시험 시 A2·A3·A10·A6이 죽는지 확인).
2. M-2: 방침 §3 첫 문장과 §1 표(정책 버전) 정리 또는 오너 확정. 변경하면 시행일·버전·`CONSENT_POLICY_VERSION` 정책을 오너가 정한다.
3. M-3: PRD AUTH-9/10 사이 빈 줄 제거.

재검증 범위: 위 수정 + `account.router.test.ts` 변이 A2·A3·A6·A10, PRD 표 렌더 확인. 나머지 영역은 이번 증거로 갈음하되, 이 절은 증거가 아니라 기록이다 — 이후 변경 시 새로 검증한다.

### 14.10 재검증 (stage-qa-agent, 2026-10-27, §14.9 수정 이후)

**최종 판정: STAGE PASS — READY FOR NEXT STAGE.** BLOCKER·HIGH·MEDIUM 없음. 남은 것은 LOW 4건뿐이다. 제품 파일은 수정하지 않았다(변이 22개 전후 `git diff`와 미추적 파일 해시가 동일).

**게이트(저장소 루트, 첫 실행):** typecheck 0, lint 0, test 0 — api 72 파일 / 1,060(이전 1,052), web 131 파일 / 1,403(이전 1,400), build 0 — 메인 청크 582.48 kB(이전 582.37), 랜딩 `home-*.js` 40.82 kB 동일, precache 11개. §7.18.4 예외 적용 없음. 공유 규칙 import로 번들이 늘지 않았다.

**§14.9 수정 확인**

| 항목 | 결과 |
|---|---|
| M-1 서버 id 출처·429 | PASS. 변이 A2(헤더)·A3(쿼리)·A3b(본문→조회)·A10(본문→삭제)·A6(제한 제거)·A6b(인증 앞으로 이동) 모두 사망 |
| M-2 방침 §3 | PASS. 아래 |
| M-3 PRD 표 | PASS. AUTH-9와 AUTH-10 사이 빈 줄 제거, AUTH-1~11이 한 표. diff는 해당 한 줄 삭제 + AUTH-11 추가뿐 |
| LOW: 팝업 문구 "계정과 기록" | PASS. 게이트·테스트·방침 §3·PRD("계정과 학습 기록")가 일치 |
| LOW: signOut 주석 | 정정됨 |
| LOW: 서버·웹 판정 불일치 | 해소. 서버가 `validation`의 `hasSignupConsentMetadata`를 쓴다. 정책 버전만·빈 문자열·공백·문자열 아님은 미동의로 보고 204. 게이트가 보이는 사용자는 항상 삭제할 수 있다 |
| LOW: FIGMA_SCREEN_MAP | CRLF 복원(`file` 확인), diff 4줄 |
| LOW: `cursor-not-allowed` | 코드 확인 |

**변이 22개 재실행, 22 사망 / 0 생존(복원 후 diff 동일).**
- 지정 항목: A2, A3, A6, A7(서버가 버전만 있는 계정을 동의로 취급 → 사망), A10, A12(409 문구), P2(다른 계정 전환), P3(비로그인 깜박임), F3(삭제 중 취소), D5(`replace`) — 전부 사망. 이전 생존자 전원이 새 테스트에 잡혔다.
- 공유 규칙 느슨화: L1 every→some, L2 trim 제거, L3 타입 검사 제거, L4 비객체→true, L5 개인정보 키 무시, L6 버전도 요구, L7 웹이 규칙을 우회, L8 서버가 규칙을 우회 — 전부 사망. L6은 api 단독 실행에서는 생존한다(웹 테스트가 잡음). 규칙이 한 곳이므로 허용 가능하나 LOW로 남긴다.

**방침 §3 정확성·일관성:** "베타 서비스는 만 14세 이상만 이용할 수 있습니다. 카카오·구글로 처음 로그인하면 계정이 먼저 만들어지고, 이어서 만 14세 이상인지 확인합니다. 만 14세 미만이라고 답하면 그 자리에서 계정과 기록을 삭제할 수 있으며, 동의하지 않은 계정으로는 서비스를 이용할 수 없습니다." 실제 동작(소셜: 계정 선생성 → 게이트, 삭제 버튼은 `DELETE /api/account/unconsented`, 이메일: 폼에서 먼저 확인)과 일치하고, 이전의 "수집하지 않습니다" 오류는 사라졌다. 이용약관 제4조("가입할 때 확인", 미만 확인 시 삭제, 보호자 동의 절차는 정식 전환 시 도입)와 게이트·팝업 문구("정식 서비스 때 이용", "보호자 동의 절차를 준비", "계정과 기록은 삭제")와 모순이 없다. §1 표에 "동의한 약관 버전"이 추가되어 저장하는 `consent_policy_version`과 맞는다.

**공유 규칙 계층·의존성(`packages/validation/src/signupConsent.ts`):** 파일에 import가 없는 순수 함수다(web·api·shared-types 비참조, 역방향 의존 없음). web은 `features/auth`만, api는 `modules/account`만 `validation`을 import한다. `shared/`는 import하지 않는다. `validation`은 두 앱에서 이미 `workspace:*` 의존이며 `package.json`·락파일 변경이 없다(새 npm 의존성 0). `index.ts`는 `export *` 한 줄만 추가된다. 웹 번들이 늘지 않았으므로 트리 셰이킹도 문제없다.

**남은 LOW**
1. api 테스트에 "세 일시는 있으나 버전 없음 → 409" 케이스가 없다(L6이 api 단독으로 생존). 웹 테스트가 같은 규칙을 고정한다.
2. 방침 §3의 "동의하지 않은 계정으로는 서비스를 이용할 수 없습니다"는 화면 기준이다. 서버 API는 동의를 검사하지 않는다(D6, 수용). 방침 "한눈에 보기"는 동의 기록을 언급하지 않는다(§1 표에는 있다).
3. 방침 본문이 바뀌었으나 시행일·버전은 그대로(2026-10-26 / 1.0)다. 아직 배포 전이므로 문제없지만, 배포 후 문구가 바뀌면 `CONSENT_POLICY_VERSION`·시행일 정책을 오너가 정한다.
4. 이 문서 §12(C-1 등)와 계획 D11에는 옛 문구 "계정 정보 삭제"가 남아 있다. 구현은 "계정과 기록"이다. design-agent §13.4 P3 3건도 그대로다.

**NOT VERIFIED(변동 없음):** 실제 iPad Safari·설치형 PWA·Apple Pencil(물리 기기), 실제 Supabase(병합·`deleteUser` cascade·RLS)와 실제 OAuth, Render 운영 호스트, 서비스 워커 런타임. 이번 재검증은 단위·통합 테스트와 변이로 했고, 1차의 실제 SDK + 가짜 GoTrue 라이브 시험은 서버 판정 규칙이 바뀐 부분(§14.3의 409 조건)을 다시 돌리지 않았다. 변경된 규칙은 api 테스트 15개가 mock으로 고정한다.
