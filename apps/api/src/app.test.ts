import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app";

describe("GET /health", () => {
  it("200과 함께 상태를 반환한다", async () => {
    const app = createApp();

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
