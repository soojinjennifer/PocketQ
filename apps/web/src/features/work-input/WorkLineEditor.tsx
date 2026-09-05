import { useState } from "react";
import { renderMathText } from "../../shared/lib/katex/renderMathText";
import { Badge } from "../../shared/ui/badge/Badge";
import { TEXT_LINK_STYLE } from "../../shared/ui/text-link/textLinkStyle";
import { ELEVATED_CARD_STYLE } from "./elevatedCardStyle";

/**
 * WORK 단계(캔버스에 필기 중)에 줄 단위로 인식된 학생 풀이 한 줄.
 *
 * 이름이 비슷한 `features/ai-solution/WorkLineList`의 `WorkLine`과는 의미가 다르다 — 그쪽의
 * `isValid`는 진단(DIAG) 이후 CAS 검증 결과를 담는 필드라 WORK 단계(진단 전)에는 해당하지 않는다.
 * feature 간 직접 참조는 금지되어 있어(`.claude/rules/frontend.md` §1) 같은 타입을 그대로
 * import할 수도 없으므로, 이 컴포넌트가 실제로 필요한 필드("인식" 상태)만 담아 별도로 정의한다.
 */
export interface WorkInputLine {
  /** 1-base 줄 번호. */
  lineNo: number;
  /** 줄 단위로 인식된 LaTeX/텍스트(WORK-2). */
  latex: string;
  /** OCR 인식 신뢰도가 임계값 미만인 줄(WORK-3 "신뢰도 기준 미만 줄에는 시각적 경고"). */
  isLowConfidence: boolean;
}

interface WorkLineEditorProps {
  lines: WorkInputLine[];
  /** 학생이 줄 텍스트를 수정해서 저장하면 호출한다. 인식 결과를 실제로 재검증하는 백엔드
   *  연동은 4단계 범위라 아직 아무도 구독하지 않아도 동작한다(내부적으로 화면에는 반영됨). */
  onSaveLine?: (lineNo: number, latex: string) => void;
}

/**
 * `docs/COMPONENT_MAP.md` §1/§3 `features/work-input/WorkLineEditor` — WORK 단계 진행 중 캔버스에
 * 쓴 학생 풀이를 줄 단위로 인식 결과로 보여주고(WORK-2), 인라인으로 수정하며(WORK-2), 저신뢰도
 * 줄에는 경고를 표시한다(WORK-3).
 *
 * **임시 UI(2026-09-05 오너 승인)**: 이 상태(WORK 진행 중 인식/수정/저신뢰도 경고)를 위한 전용
 * Figma 프레임이 없다(`docs/COMPONENT_MAP.md` §3, `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §7 —
 * design-agent가 `MathService` 파일 전체를 조사했으나 확인된 없음). 기존 배지 톤 팔레트를 재사용한
 * 임시값으로 우선 구현하고, Figma 정식 디자인이 추가되면 교체하는 것을 전제로 한다(과거
 * `icon="error"` Modal variant, `ChatBubble` 임시 구현과 동일한 선례). 재사용 출처:
 * - 줄번호 + 본문 레이아웃: `Solve/Work Line`(`248:53`) 심볼 구조만 참고(판정 배지는 대상 아님).
 * - "인식됨" 배지: `RecognizedProblemBar`의 `tint-green` chip을 그대로 재사용(정확한 Figma 대응
 *   요소 확인 안 됨 — `39:39`는 파일에 존재하지 않는 노드였음, 참고로 `254:60`~`254:62`가 유사
 *   요소이나 라벨이 "인식된 문제"로 다름).
 * - "확인 필요"(저신뢰도 경고) 문구/색: 새 색상을 만들지 않고, 같은 feature 계열
 *   (`WorkLineList`/`DiagnosisCard`)이 이미 쓰는 `text-accent-orange` 텍스트 패턴을 그대로 재사용.
 *   **결정 필요**: Figma에 저신뢰도 전용 색상/배지가 없어 임시로 `text-accent-orange`를 썼다 —
 *   정식 디자인이 나오면 교체 대상이다.
 * - 수정 진입 어포던스: `shared/ui/text-link`의 `TEXT_LINK_STYLE`(Figma `203:328`/`330`, AUTH
 *   흐름에서 이미 사용 중)을 그대로 재사용 — 새 링크 스타일을 만들지 않았다.
 *
 * 이번 단계는 하드코딩된 목업 `WorkInputLine[]`만 다룬다 — 실제 인식/재인식 API 연동은 4단계
 * 범위다. 아직 어느 페이지에도 mount하지 않는다.
 */
export function WorkLineEditor({ lines, onSaveLine }: WorkLineEditorProps) {
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [editingLineNo, setEditingLineNo] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (lines.length === 0) {
    return null;
  }

  function startEditing(line: WorkInputLine) {
    setEditingLineNo(line.lineNo);
    setDraft(overrides[line.lineNo] ?? line.latex);
  }

  function cancelEditing() {
    setEditingLineNo(null);
    setDraft("");
  }

  function saveEditing(lineNo: number) {
    const trimmed = draft.trim();
    if (trimmed.length > 0) {
      setOverrides((prev) => ({ ...prev, [lineNo]: trimmed }));
      onSaveLine?.(lineNo, trimmed);
    }
    setEditingLineNo(null);
    setDraft("");
  }

  return (
    <div className={`${ELEVATED_CARD_STYLE} flex flex-col gap-3`}>
      <p className="text-label-primary text-[12px] leading-[16px] font-[590]">내 풀이</p>
      <ul className="flex flex-col gap-2">
        {lines.map((line) => {
          const displayLatex = overrides[line.lineNo] ?? line.latex;
          const isEditing = editingLineNo === line.lineNo;

          return (
            <li key={line.lineNo}>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <span className="text-label-tertiary w-[16px] shrink-0 text-[11px] font-bold">
                    {line.lineNo}
                  </span>
                  <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    aria-label={`${line.lineNo}번째 줄 수정`}
                    className="border-separator text-label-primary focus-visible:ring-brand flex-1 rounded-[6px] border px-2 py-1 text-[13px] leading-[18px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  />
                  <button
                    type="button"
                    onClick={() => saveEditing(line.lineNo)}
                    className={TEXT_LINK_STYLE}
                  >
                    저장
                  </button>
                  <button type="button" onClick={cancelEditing} className={TEXT_LINK_STYLE}>
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="text-label-tertiary w-[16px] shrink-0 text-[11px] font-bold">
                    {line.lineNo}
                  </span>
                  <p className="text-label-primary flex-1 text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
                    {renderMathText(displayLatex)}
                  </p>
                  {line.isLowConfidence ? (
                    <span className="text-accent-orange shrink-0 text-[11px] leading-[16px] font-[590]">
                      확인 필요
                    </span>
                  ) : (
                    <Badge variant="tint-green" size="chip">
                      인식됨
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => startEditing(line)}
                    className={TEXT_LINK_STYLE}
                  >
                    수정
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
