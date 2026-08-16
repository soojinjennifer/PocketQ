import { describe, expect, it } from "vitest";
import { formatHistoryDate } from "./formatHistoryDate";

// 로컬 타임존 의존을 없애기 위해 기준 시각도 로컬 생성자로 만든다.
const NOW = new Date(2026, 7, 16, 12, 0, 0); // 2026-08-16 12:00 (로컬)

describe("formatHistoryDate", () => {
  it("오늘이면 '오늘 HH:MM'으로 표기한다", () => {
    expect(formatHistoryDate(new Date(2026, 7, 16, 22, 14).toISOString(), NOW)).toBe("오늘 22:14");
  });

  it("어제면 '어제 HH:MM'으로 표기한다", () => {
    expect(formatHistoryDate(new Date(2026, 7, 15, 21, 3).toISOString(), NOW)).toBe("어제 21:03");
  });

  it("같은 해의 그 외 날짜는 'M월 D일'로 표기한다", () => {
    expect(formatHistoryDate(new Date(2026, 6, 12, 9, 30).toISOString(), NOW)).toBe("7월 12일");
  });

  it("다른 해면 연도를 함께 표기한다", () => {
    expect(formatHistoryDate(new Date(2025, 11, 31, 9, 30).toISOString(), NOW)).toBe(
      "2025년 12월 31일",
    );
  });

  it("파싱할 수 없는 값이면 빈 문자열을 반환한다", () => {
    expect(formatHistoryDate("not-a-date", NOW)).toBe("");
  });
});
