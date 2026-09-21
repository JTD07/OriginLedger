import { describe, expect, test } from "vitest";
import {
  healthContainsSecrets,
  healthResponse,
  isHealthResponse,
} from "./health";

describe("health endpoint shape", () => {
  test("returns only status and version", () => {
    const body = healthResponse("0.1.0");
    expect(body).toEqual({ status: "ok", version: "0.1.0" });
    expect(isHealthResponse(body)).toBe(true);
    expect(Object.keys(body)).toEqual(["status", "version"]);
  });

  test("does not include secrets or dependency details", () => {
    const body = healthResponse();
    expect(healthContainsSecrets(body)).toBe(false);
    expect(JSON.stringify(body)).not.toContain("SENTRY");
    expect(JSON.stringify(body)).not.toContain("SUPABASE");
    expect(JSON.stringify(body)).not.toContain("localhost");
  });
});
