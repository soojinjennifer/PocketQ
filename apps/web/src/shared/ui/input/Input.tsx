import type { HTMLAttributes } from "react";

export interface InputFieldConfig {
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  /** 네이티브 input의 inputMode. 예: 인증 코드처럼 숫자 키패드가 필요한 필드는 "numeric"을 지정한다. */
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  /** 입력 가능한 최대 문자 수. 예: 8자리 인증 코드 필드. */
  maxLength?: number;
}

interface InputGroupProps {
  fields: InputFieldConfig[];
}

/**
 * Figma `Button/Input` 컴포넌트(node `96:178`/`96:177`) 실측 스타일.
 * 이메일/비밀번호 등 여러 입력 필드를 하나의 카드 컨테이너로 감싼다.
 */
export function InputGroup({ fields }: InputGroupProps) {
  return (
    <div className="bg-bg-elevated rounded-[14px] overflow-hidden">
      {fields.map((field, index) => (
        <div key={field.name}>
          {index > 0 ? <div className="h-px bg-separator" /> : null}
          <div className="px-[16px] py-[13px]">
            <input
              type={field.type ?? "text"}
              name={field.name}
              aria-label={field.placeholder}
              placeholder={field.placeholder}
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
              autoComplete={field.autoComplete}
              inputMode={field.inputMode}
              maxLength={field.maxLength}
              className="text-[16px] leading-[21px] text-label-primary w-full outline-none bg-transparent border-0 placeholder:text-label-tertiary"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
