import { describe, expect, test } from "vitest";
import { GENERIC_AUTH_ERROR, mapAuthError } from "./errors";

describe("mapAuthError", () => {
  test("maps known codes to safe messages", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toBe(
      "Email or password is incorrect.",
    );
  });

  test("does not echo provider error text", () => {
    const leaked = "user owner@example.com does not exist";
    const message = mapAuthError({ code: "unknown_code", message: leaked });
    expect(message).toBe(GENERIC_AUTH_ERROR);
    expect(message).not.toContain(leaked);
    expect(message).not.toContain("owner@example.com");
  });
});
