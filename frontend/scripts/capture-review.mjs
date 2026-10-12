import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = fileURLToPath(new URL("../../demo/", import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
async function capture(name) {
  await page.screenshot({
    path: out + name + ".jpg",
    type: "jpeg",
    quality: 88,
    animations: "disabled",
    fullPage: true,
  });
}
try {
  await page.goto("http://127.0.0.1:5173");
  await expect(page.getByLabel("Sample program")).toHaveValue("hero");
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/analyze"),
  );
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  const report = await (await response).json();
  await expect(page.getByTestId("stat-functions")).toContainText("1");
  await capture("desktop-overview");
  await page.getByRole("tab", { name: /^Diagnostics/ }).click();
  const f = report.data.findings.find((f) => f.ruleId === "CS-SEC-005");
  await page
    .getByRole("button", {
      name: `View line ${f.range.line} in source`,
      exact: true,
    })
    .click();
  await capture("desktop-diagnostics");
  await page.getByRole("tab", { name: "Control flow", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect block B0", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit graph", exact: true }).click();
  await capture("desktop-control-flow");
  await page.getByRole("tab", { name: "Optimization", exact: true }).click();
  await page
    .getByRole("heading", { name: "Optimized TAC", exact: true })
    .waitFor();
  await capture("desktop-optimization");
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  await page.getByRole("tab", { name: "Data flow", exact: true }).click();
  await expect(page.getByText(/Fixed point reached in/)).toBeVisible();
  await capture("desktop-data-flow");
  await page.setViewportSize({ width: 768, height: 1024 });
  await capture("tablet-compiler");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await capture("mobile-overview");
  // A deterministic stress fixture measures DOM size; timings are local observations only.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByLabel("C source")
    .fill(
      Array.from(
        { length: 150 },
        (_, i) => `int f${i}(void){int x=1;return x;}`,
      ).join("\n"),
    );
  const next = page.waitForResponse((r) => r.url().endsWith("/api/analyze"));
  const start = performance.now();
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  const stress = await (await next).json();
  const responseMs = Math.round(performance.now() - start);
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  const viewStart = performance.now();
  await page.getByRole("tab", { name: "Tokens", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(100);
  const observation = {
    fixture: "150 simple functions",
    tokens: stress.data.summary.tokenCount,
    responseMs,
    tokenViewMs: Math.round(performance.now() - viewStart),
    renderedRows: await page.locator("tbody tr").count(),
    domNodes: await page.locator("*").count(),
  };
  console.log(
    JSON.stringify({
      hero: report.data.summary,
      dataFlowRounds: report.data.modules.dataFlow.data.map((f) => ({
        function: f.functionName,
        live: f.liveVariables?.rounds,
        reaching: f.reachingDefinitions?.rounds,
      })),
      observation,
      errors,
    }),
  );
  expect(errors).toEqual([]);
} finally {
  await browser.close();
}
