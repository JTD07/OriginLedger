import { describe, expect, test } from "vitest";
import {
  interpolationData,
  renderTemplate,
  sanitizePlainText,
} from "./templates";

describe("disclosure templates", () => {
  test("interpolates structured fields into English text", () => {
    const data = interpolationData({
      provider: "Northwind",
      model: "OriginDraw",
      modelVersion: "3",
      generationDate: "2026-01-02",
    });
    const text = renderTemplate("limited.ai_involved", data);
    expect(text).toContain("Northwind");
    expect(text).toContain("OriginDraw");
    expect(text).toContain("3");
    expect(text).not.toContain("{{");
  });

  test("strips markup from interpolation values", () => {
    const data = interpolationData({
      provider: "<script>alert(1)</script>",
      model: "{{nested}}",
      modelVersion: "",
      generationDate: "",
    });
    expect(data.provider).not.toContain("<");
    expect(data.model).not.toContain("{");
    const text = renderTemplate("prominent.ai_involved", data);
    expect(text).not.toMatch(/<script/i);
    expect(text).not.toContain("{{nested}}");
  });

  test("does not execute user text as a template", () => {
    const data = interpolationData({
      provider: "{{model}}",
      model: "SAFE",
      modelVersion: "",
      generationDate: "",
    });
    expect(sanitizePlainText("{{model}}")).toBe("model");
    const text = renderTemplate("limited.ai_involved", data);
    expect(text).not.toContain("{{");
    expect(data.provider).toBe("model");
  });
});
