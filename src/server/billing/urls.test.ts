import { describe, expect, test } from "vitest";
import {
  checkoutCancelUrl,
  checkoutSuccessUrl,
  billingReturnUrl,
} from "./urls";

describe("billing URLs", () => {
  test("builds server-controlled success and cancel URLs", () => {
    expect(checkoutSuccessUrl("http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000/app/billing?checkout=processing",
    );
    expect(checkoutCancelUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/app/billing?checkout=cancelled",
    );
    expect(billingReturnUrl("https://app.example.com/extra")).toBe(
      "https://app.example.com/app/billing",
    );
  });
});
