import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getUserNickname } from "./getUserNickname";

function userWith(metadata: Record<string, unknown>): User {
  return { user_metadata: metadata } as User;
}

describe("getUserNickname", () => {
  it("user_metadata.nickname 문자열을 반환한다", () => {
    expect(getUserNickname(userWith({ nickname: "지민" }))).toBe("지민");
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(getUserNickname(userWith({ nickname: "  지민  " }))).toBe("지민");
  });

  it("공백뿐이거나 없거나 문자열이 아니면 null을 반환한다", () => {
    expect(getUserNickname(userWith({ nickname: "   " }))).toBeNull();
    expect(getUserNickname(userWith({}))).toBeNull();
    expect(getUserNickname(userWith({ nickname: 123 }))).toBeNull();
    expect(getUserNickname(null)).toBeNull();
  });
});
