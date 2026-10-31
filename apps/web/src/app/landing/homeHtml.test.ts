// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const homeHtml = readFileSync(
  fileURLToPath(new URL("../../../home.html", import.meta.url)),
  "utf8",
);
const ogImagePath = fileURLToPath(new URL("../../../public/og-landing-v2.png", import.meta.url));
const OG_IMAGE_URL = "https://pocketq.groundmoyo.com/og-landing-v2.png";

function metaContent(attribute: "property" | "name", key: string): string | null {
  const pattern = new RegExp(
    `<meta\\s+${attribute}="${key.replace(/[.:]/g, "\\$&")}"\\s+content="([^"]*)"`,
  );
  return pattern.exec(homeHtml)?.[1] ?? null;
}

describe("home.html 공유 메타(OG, Round 2 D)", () => {
  it.each([
    ["property", "og:image", OG_IMAGE_URL],
    ["property", "og:image:width", "1200"],
    ["property", "og:image:height", "630"],
    ["property", "og:image:type", "image/png"],
    ["property", "og:image:alt", "수풀잉 — 학교에서는 알겠다는데, 혼자 풀면 막히나요?"],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:image", OG_IMAGE_URL],
  ] as const)("%s=%s", (attribute, key, expected) => {
    expect(metaContent(attribute, key)).toBe(expected);
  });

  it("public/og-landing-v2.png는 1200×630 PNG이고 300KB 이하다", () => {
    const png = readFileSync(ogImagePath);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.byteLength).toBeLessThanOrEqual(300 * 1024);
  });
});
