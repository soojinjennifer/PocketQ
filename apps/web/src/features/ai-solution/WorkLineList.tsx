import { renderMathText } from "../../shared/lib/katex/renderMathText";
import { Badge } from "../../shared/ui/badge/Badge";
import { ELEVATED_CARD_STYLE } from "./elevatedCardStyle";

export interface WorkLine {
  /** 1-base 줄 번호(WORK-2 "줄 번호를 가진 배열"). */
  lineNo: number;
  /** 줄 단위로 인식된 LaTeX(WORK-2). */
  latex: string;
  /** CAS 정답 판정 결과(DIAG-1). 아직 진단 전(WORK 단계)이면 `null`(배지 없음), 이후
   *  `true`="확인"/`false`="막힌 지점"으로 렌더링한다. */
  isValid: boolean | null;
}

interface WorkLineListProps {
  lines: WorkLine[];
}

/**
 * `docs/COMPONENT_MAP.md` §1 `Solve/Work Line`(마스터 심볼 `248:53`, 356×26px) Figma 실측 기반 —
 * 인식된 학생 풀이를 줄 단위로 보여준다(WORK-2/WORK-3). 줄 단위 수정 UI(`WorkLineEditor`)는 별도
 * 컴포넌트이며 아직 구현하지 않는다(§7 "WORK-2/3 중간 상태 Figma 미확인", 이번 작업 범위 밖).
 *
 * 행 구조: 줄번호(순수 텍스트, 배지 아님) + 풀이 내용 + 판정 배지("확인"/"막힌 지점"). 이 심볼이
 * 표현하는 것은 "인식 신뢰도"가 아니라 "정답 판정"이므로 저신뢰도 경고 variant는 없다(§1 주의사항).
 * `w-[356px]` 고정폭은 Figma 마스터 심볼의 실측값일 뿐, 화면 폭에 반응하도록 카드 컨테이너 폭에
 * 맞춰 늘어나게 한다(`.claude/rules/frontend.md` §3.5).
 *
 * 이번 단계는 하드코딩된 목업 `WorkLine[]`만 렌더링한다 — 백엔드 인식 API 연동은 4단계 범위다.
 */
export function WorkLineList({ lines }: WorkLineListProps) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className={`${ELEVATED_CARD_STYLE} flex flex-col gap-3`}>
      <p className="text-label-primary text-[12px] leading-[16px] font-[590]">내 풀이</p>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => (
          <li
            key={line.lineNo}
            className={
              line.isValid === false
                ? "bg-fill-tint-red/50 flex items-start gap-[8px] rounded-[8px] p-[4px]"
                : "flex items-start gap-[8px] rounded-[8px] p-[4px]"
            }
          >
            <span className="text-label-tertiary w-[16px] shrink-0 text-[11px] font-bold">{line.lineNo}</span>
            <p className="text-label-primary flex-1 text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
              {renderMathText(line.latex)}
            </p>
            {line.isValid === true ? (
              <Badge variant="tint-green" size="judgment">
                확인
              </Badge>
            ) : null}
            {line.isValid === false ? (
              <Badge variant="tint-red" size="judgment">
                막힌 지점
              </Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
