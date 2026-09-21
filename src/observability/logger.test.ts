import { describe, expect, test } from "vitest";
import { withCorrelation } from "./correlation-als";
import { buildLogRecord } from "./logger";

describe("structured logging", () => {
  test("keeps only safe fields and redacts nested secrets", () => {
    const error = new Error("Authorization: Bearer super-secret");
    error.cause = { stripeSecret: "sk_test_leaked", body: { notes: "hi" } };
    const record = buildLogRecord(
      {
        severity: "error",
        event: "job_failed",
        correlationId: "corr-123456",
        routeTemplate: "/api/health",
        status: 500,
        durationMs: 9,
        errorClass: "HealthError",
      },
      error,
    );
    const serialized = JSON.stringify(record);
    expect(record.event).toBe("job_failed");
    expect(record.correlationId).toBe("corr-123456");
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("sk_test_leaked");
    expect(serialized).not.toContain("notes");
    expect(record).not.toHaveProperty("body");
    expect(record).not.toHaveProperty("cause");
  });

  test("attaches the ALS correlation id for concurrent work", async () => {
    const first = withCorrelation("request-aaaa", async () => {
      await Promise.resolve();
      return buildLogRecord({ severity: "info", event: "one" });
    });
    const second = withCorrelation("request-bbbb", async () => {
      await Promise.resolve();
      return buildLogRecord({ severity: "info", event: "two" });
    });
    const [a, b] = await Promise.all([first, second]);
    expect(a.correlationId).toBe("request-aaaa");
    expect(b.correlationId).toBe("request-bbbb");
    expect(a.correlationId).not.toBe(b.correlationId);
  });
});
