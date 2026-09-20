import { describe, expect, test } from "vitest";
import { credentialsSchema, fieldErrorsFromZod, recoverSchema } from "./schema";

describe("auth schemas", () => {
  test("accepts a valid email and password", () => {
    expect(
      credentialsSchema.parse({
        email: "owner@example.com",
        password: "correct1",
      }),
    ).toEqual({
      email: "owner@example.com",
      password: "correct1",
    });
  });

  test("rejects a short password without echoing it", () => {
    const result = credentialsSchema.safeParse({
      email: "owner@example.com",
      password: "short1",
    });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    const errors = fieldErrorsFromZod(result.error);
    expect(errors.password).toBe("Use at least 8 characters.");
    expect(JSON.stringify(result.error)).not.toContain("short1");
  });

  test("rejects an invalid recovery email", () => {
    const result = recoverSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(fieldErrorsFromZod(result.error).email).toBe(
      "Enter a valid email address.",
    );
  });
});
