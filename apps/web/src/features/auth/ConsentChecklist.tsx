import { Fragment, useId } from "react";
import { Checkbox } from "../../shared/ui/checkbox/Checkbox";
import { TEXT_LINK_STYLE } from "../../shared/ui/text-link/textLinkStyle";
import type { ConsentState } from "./signupConsent";

/** 비활성 제출 버튼의 사유를 스크린리더에 알리는 안내(A-5). 게이트와 회원가입이 공유한다. */
export const CONSENT_INCOMPLETE_HINT = "세 항목에 모두 동의하면 시작할 수 있어요";

interface ConsentRow {
  key: keyof ConsentState;
  label: string;
  /** 문서 링크. 나이 확인 행에는 없다. */
  link?: { href: string; documentName: string };
}

const CONSENT_ROWS: readonly ConsentRow[] = [
  { key: "age14", label: "만 14세 이상입니다" },
  { key: "terms", label: "이용약관에 동의합니다", link: { href: "/terms.html", documentName: "이용약관" } },
  {
    key: "privacy",
    label: "개인정보처리방침에 동의합니다",
    link: { href: "/privacy.html", documentName: "개인정보처리방침" },
  },
];

interface ConsentChecklistProps {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
  /** 제출 중에는 체크박스를 비활성화한다. 문서 링크는 계속 열 수 있다. */
  disabled?: boolean;
  /**
   * 넘기면 이 id로 sr-only 안내(`CONSENT_INCOMPLETE_HINT`)를 렌더한다. 호출부는 같은 id를 제출 버튼의
   * `aria-describedby`에 연결한다(A-5).
   */
  hintId?: string;
}

/**
 * 가입 동의 체크리스트(필수 3항목, `docs/SIGNUP_CONSENT_DESIGN.md` §3). 제어 컴포넌트다.
 * 가입 동의 게이트와 `/register` 이메일 폼이 같은 컴포넌트를 쓴다.
 *
 * - 카드: `InputGroup`과 같은 `bg-bg-elevated rounded-[14px]` + `bg-separator` 구분선.
 *   행 안 포커스 링이 잘리지 않도록 `overflow-hidden`은 쓰지 않는다.
 * - 행: `<label>`이 체크박스와 문구를 감싸 행 왼쪽 끝부터 링크 직전까지가 토글 영역(44pt 이상)이다.
 *   "보기" 링크는 라벨의 형제로 두어, 링크를 눌러도 체크가 바뀌지 않는다.
 * - 접근 가능한 이름은 보이는 라벨 전체이며 `aria-label`을 쓰지 않는다(WCAG 2.5.3).
 */
export function ConsentChecklist({ value, onChange, disabled = false, hintId }: ConsentChecklistProps) {
  const idPrefix = useId();

  return (
    <>
      <fieldset className="bg-bg-elevated min-w-0 rounded-[14px] break-keep">
        <legend className="sr-only">가입 동의 (모두 필수)</legend>
        {CONSENT_ROWS.map((row, index) => {
          const checkboxId = `${idPrefix}-${row.key}`;
          return (
            <Fragment key={row.key}>
              {index > 0 ? <div className="bg-separator h-px" /> : null}
              <div className="flex items-stretch">
                <label
                  htmlFor={checkboxId}
                  className={`flex min-h-11 flex-1 items-center gap-3 py-2 pl-4 ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${row.link ? "pr-2" : "pr-4"}`}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={value[row.key]}
                    disabled={disabled}
                    onChange={(checked) => onChange({ ...value, [row.key]: checked })}
                  />
                  <span className="text-label-primary text-[16px] leading-[21px]">
                    <span className="text-brand font-[590]">(필수)</span> {row.label}
                  </span>
                </label>
                {row.link ? (
                  <a
                    href={row.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${TEXT_LINK_STYLE} inline-flex min-h-11 min-w-11 items-center justify-center pr-4 pl-2`}
                  >
                    {/* 공백은 sr-only 안이 아닌 보이는 텍스트 쪽에 둔다(접근 가능한 이름 "이용약관 보기 (새 탭)").
                        inline-flex 안에서 앞뒤 공백은 화면에 드러나지 않는다. */}
                    <span className="sr-only">{row.link.documentName}</span>
                    {" 보기 "}
                    <span className="sr-only">(새 탭)</span>
                  </a>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </fieldset>
      {hintId ? (
        <p id={hintId} className="sr-only">
          {CONSENT_INCOMPLETE_HINT}
        </p>
      ) : null}
    </>
  );
}
