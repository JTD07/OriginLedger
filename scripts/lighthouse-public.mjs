import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { launch } from "chrome-launcher";
import lighthouse, { desktopConfig } from "lighthouse";

const BASE_URL = process.env.LIGHTHOUSE_BASE_URL ?? "http://127.0.0.1:3000";

const PUBLIC_ROUTES = [
  { id: "landing", path: "/" },
  { id: "security", path: "/security" },
  { id: "privacy", path: "/privacy" },
  { id: "terms", path: "/terms" },
  { id: "not-found", path: "/this-route-does-not-exist" },
  { id: "share-unavailable", path: "/share/unavailable-token" },
];

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

function scoreOf(result, category) {
  const value = result.lhr.categories[category]?.score;
  return typeof value === "number" ? Math.round(value * 100) : null;
}

function containsSensitive(text) {
  return /token=|origin-assets\/|evidence-packets\/|service_role|sk_live|sk_test/i.test(
    text,
  );
}

const chrome = await launch({
  chromeFlags: ["--headless", "--no-sandbox"],
});

try {
  await mkdir("lighthouse-reports", { recursive: true });
  const rows = [];
  let lighthouseVersion = null;
  for (const route of PUBLIC_ROUTES) {
    const url = new URL(route.path, BASE_URL).toString();
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: "json",
        onlyCategories: CATEGORIES,
      },
      desktopConfig,
    );
    if (!result) {
      throw new Error(`lighthouse returned no result for ${route.path}`);
    }
    lighthouseVersion = result.lhr.lighthouseVersion;
    const failedAudits = Object.values(result.lhr.audits)
      .filter(
        (audit) =>
          typeof audit.score === "number" &&
          audit.score < 1 &&
          audit.scoreDisplayMode !== "informative" &&
          audit.scoreDisplayMode !== "manual" &&
          audit.scoreDisplayMode !== "notApplicable",
      )
      .map((audit) => ({ id: audit.id, score: audit.score }));
    const serialized = JSON.stringify(result.lhr);
    if (containsSensitive(serialized)) {
      throw new Error(
        `Refusing to write a Lighthouse report that contains a private URL or token (${route.path}).`,
      );
    }
    const scores = {
      route: route.path,
      performance: scoreOf(result, "performance"),
      accessibility: scoreOf(result, "accessibility"),
      bestPractices: scoreOf(result, "best-practices"),
      seo: scoreOf(result, "seo"),
      runtimeError: result.lhr.runtimeError?.code ?? null,
      failedAudits,
    };
    rows.push(scores);
    const sanitized = {
      requestedUrl: result.lhr.requestedUrl,
      fetchTime: result.lhr.fetchTime,
      lighthouseVersion: result.lhr.lighthouseVersion,
      runtimeError: result.lhr.runtimeError
        ? { code: result.lhr.runtimeError.code }
        : null,
      failedAudits,
      configSettings: {
        formFactor: result.lhr.configSettings.formFactor,
        screenEmulation: result.lhr.configSettings.screenEmulation,
      },
      categories: Object.fromEntries(
        CATEGORIES.map((category) => [
          category,
          { score: result.lhr.categories[category]?.score ?? null },
        ]),
      ),
    };
    await writeFile(
      path.join("lighthouse-reports", `${route.id}.json`),
      `${JSON.stringify(sanitized, null, 2)}\n`,
    );
    console.log(JSON.stringify(scores));
  }
  console.log(
    JSON.stringify({
      lighthouseVersion,
      baseUrl: BASE_URL,
      formFactor: "desktop",
      buildMode: "production",
      rows,
    }),
  );
} finally {
  await chrome.kill();
}
