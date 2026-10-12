import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const out = fileURLToPath(new URL("../../demo/", import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  recordVideo: { dir: out, size: { width: 1440, height: 1100 } },
});
const page = await context.newPage();
const pause = () => page.waitForTimeout(2000);
try {
  await page.goto(process.env.CODESENTINEL_URL || "http://127.0.0.1:5173");
  await expect(page.getByLabel("Sample program")).toHaveValue("hero");
  await page.screenshot({ path: out + "empty.png", fullPage: true });
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  const report = await (await response).json();
  await expect(page.getByTestId("stat-functions")).toContainText("1");
  await writeFile(out + "hero-analysis.json", JSON.stringify(report, null, 2));
  await pause();
  await page.screenshot({ path: out + "overview.png", fullPage: true });
  await page.getByRole("tab", { name: /^Diagnostics/ }).click();
  await page
    .getByRole("button", { name: "View line 20 in source", exact: true })
    .click();
  await pause();
  await page.screenshot({ path: out + "diagnostics.png", fullPage: true });
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  await page
    .getByRole("button", { name: "Function review_submission", exact: true })
    .click();
  await pause();
  await page.screenshot({ path: out + "ast.png", fullPage: true });
  await page.getByRole("tab", { name: "Symbols", exact: true }).click();
  await pause();
  await page.getByRole("tab", { name: "Optimization", exact: true }).click();
  await page
    .getByRole("heading", { name: "Optimized TAC", exact: true })
    .waitFor();
  await pause();
  await page.screenshot({ path: out + "optimization.png", fullPage: true });
  await page.getByRole("tab", { name: "Control flow", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect block B0", exact: true })
    .click();
  await pause();
  await page.screenshot({ path: out + "control-flow.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const file = await download;
  expect(JSON.parse(await readFile(await file.path(), "utf8"))).toEqual(report);
  await page.getByLabel("Sample program").selectOption("syntax-error");
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  await expect(page.getByTestId("analysis-status")).toHaveText("Syntax error");
  await pause();
  await page.getByLabel("Sample program").selectOption("bounded");
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  await expect(page.getByTestId("analysis-status")).toHaveText(
    "Analysis complete",
  );
  await pause();
  const video = page.video();
  await context.close();
  await video.saveAs(out + "codesentinel-walkthrough.webm");
  await unlink(await video.path());
  console.log("Saved actual UI walkthrough and backend report in demo/.");
} finally {
  await browser.close();
}
