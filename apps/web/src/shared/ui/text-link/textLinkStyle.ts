/**
 * Figma `203:328`/`203:330` 실측 — 밑줄 텍스트 링크(SF Pro Semibold 15px/20px/590,
 * 색상 `--color-brand`). 배경이 있는 pill/전체폭 모델인 공용 `Button`과 형태가 달라
 * 별도 공용 상수로 둔다. 로그인 화면과 비밀번호 재설정 팝업 등 여러 화면에서 재사용한다
 * (스타일 드리프트 방지를 위해 지역 상수로 복제하지 않는다).
 */
/**
 * 텍스트 링크 공용 포커스 표시(Stage 5 S5-V10, `docs/FIGURE_DESIGN.md` §18.13 — 오너 승인). `Button`과 같은 링
 * (`ring-2 ring-brand ring-offset-2`, 키보드 조작 때만) + 기존 chip 모서리 `rounded-[6px]`. 밑줄 링크(`TEXT_LINK_STYLE`)와
 * 인식 바의 "수정"/"다시 풀기"(`RecognizedProblemBar`)가 함께 쓴다 — 같은 조합을 화면마다 복사하지 않는다(frontend.md §2).
 * `Button`은 자체 `FOCUS_STYLE`을 그대로 쓴다(이번에 바꾸지 않음).
 */
export const TEXT_LINK_FOCUS_RING =
  "rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

export const TEXT_LINK_STYLE = `text-brand text-[15px] leading-[20px] font-[590] underline disabled:opacity-50 ${TEXT_LINK_FOCUS_RING}`;
