import { describe, expect, test } from "vitest";
import { APP_HOME_PATH, safeInternalPath } from "./paths";

describe("safeInternalPath", () => {
  test("allows an internal app path", () => {
    expect(safeInternalPath("/app")).toBe("/app");
    expect(safeInternalPath("/app/settings")).toBe("/app/settings");
  });

  test("rejects open redirects", () => {
    expect(safeInternalPath("https://evil.example")).toBe(APP_HOME_PATH);
    expect(safeInternalPath("//evil.example")).toBe(APP_HOME_PATH);
    expect(safeInternalPath("/\\evil.example")).toBe(APP_HOME_PATH);
    expect(safeInternalPath("not-a-path")).toBe(APP_HOME_PATH);
  });
});
