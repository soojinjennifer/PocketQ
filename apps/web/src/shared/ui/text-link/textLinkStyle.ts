/**
 * Figma `203:328`/`203:330` 실측 — 밑줄 텍스트 링크(SF Pro Semibold 15px/20px/590,
 * 색상 `--color-brand`). 배경이 있는 pill/전체폭 모델인 공용 `Button`과 형태가 달라
 * 별도 공용 상수로 둔다. 로그인 화면과 비밀번호 재설정 팝업 등 여러 화면에서 재사용한다
 * (스타일 드리프트 방지를 위해 지역 상수로 복제하지 않는다).
 */
export const TEXT_LINK_STYLE =
  "text-brand text-[15px] leading-[20px] font-[590] underline disabled:opacity-50";
