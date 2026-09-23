import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * WCAG tags scanned by OriginLedger axe tests:
 * - wcag2a / wcag2aa: WCAG 2.0 A and AA
 * - wcag21a / wcag21aa: WCAG 2.1 A and AA
 * - wcag22aa: WCAG 2.2 AA
 *
 * Tests fail on any violation. There are no rule exclusions.
 * Results are asserted by rule id and target selector only; HTML
 * containing user content is not snapshotted.
 */
export const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

export function formatAxeViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
): string {
  if (violations.length === 0) {
    return "no accessibility violations";
  }
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => node.target.map(String).join(" "))
        .join("; ");
      return `${violation.id} (${violation.impact ?? "unknown"}): ${targets}`;
    })
    .join(" | ");
}

export async function expectNoAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags([...AXE_TAGS])
    .analyze();
  expect(formatAxeViolations(results.violations), label).toBe(
    "no accessibility violations",
  );
}
