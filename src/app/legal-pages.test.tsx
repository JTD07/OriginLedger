import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import SecurityPage from "@/app/security/page";
import TermsPage from "@/app/terms/page";

afterEach(() => {
  cleanup();
});

test("privacy and terms pages are marked as draft placeholders", () => {
  render(<PrivacyPage />);
  expect(screen.getByRole("status").textContent).toMatch(/draft placeholder/i);
  expect(screen.getByRole("heading", { name: "Privacy policy" })).toBeDefined();
  expect(document.body.textContent).toMatch(/does not claim GDPR/);
  expect(document.body.textContent).not.toMatch(/123 Main/);
});

test("terms page stays a counsel-review placeholder", () => {
  render(<TermsPage />);
  expect(screen.getByRole("status").textContent).toMatch(/qualified counsel/i);
  expect(document.body.textContent).toMatch(
    /does not claim GDPR, CCPA, HIPAA, SOC 2/,
  );
});

test("security page describes implemented controls without absolute claims", () => {
  render(<SecurityPage />);
  expect(screen.getByRole("heading", { name: "Security" })).toBeDefined();
  expect(document.body.textContent).toMatch(/not absolutely secure/);
  expect(document.body.textContent).toMatch(/not independently certified/);
  expect(document.body.textContent).toMatch(/row-level security/);
});
