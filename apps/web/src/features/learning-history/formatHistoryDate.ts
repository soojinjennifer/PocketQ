function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * History Row의 날짜 표기. Figma 스크린샷에 "오늘 22:14"/"어제 21:03"/"7월 12일" 같은 상대 표기가
 * 보이지만 정확한 규칙은 문서화돼 있지 않다 — **Figma 없음, 결정 필요**(오너 확인 후 조정 가능).
 * 지금은 다음 상식적인 규칙을 쓴다:
 * - 오늘: `오늘 HH:MM`
 * - 어제: `어제 HH:MM`
 * - 그 외 같은 해: `M월 D일`
 * - 다른 해: `YYYY년 M월 D일`(연도를 생략하면 몇 년 전 기록과 구분되지 않아 추가했다 — 결정 필요)
 *
 * 신규 npm 의존성 없이 순수 `Date`만 사용한다. 파싱할 수 없는 값이면 빈 문자열을 반환해
 * 행 전체가 깨지지 않게 한다.
 */
export function formatHistoryDate(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / MS_PER_DAY);
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  if (dayDiff === 0) {
    return `오늘 ${time}`;
  }
  if (dayDiff === 1) {
    return `어제 ${time}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
