import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function ready(page) {
  await page.goto("/");
  await expect(page.getByLabel("Sample program")).toHaveValue("hero");
  await expect(
    page.getByText("Local backend connected", { exact: true }),
  ).toHaveText("Local backend connected");
}
async function analyze(page) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  const payload = await (await response).json();
  expect(payload.success).toBe(true);
  await expect(
    page.getByRole("button", { name: /^Analyze code/ }),
  ).toBeEnabled();
  await expect(page.getByRole("tabpanel")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  return payload;
}
const section = (page, name) =>
  page
    .locator("section:not([aria-label])")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });

test("performance and duplication findings have their own diagnostic categories", async ({
  page,
}) => {
  await ready(page);
  for (const [sample, category, heading] of [
    ["loops", "Performance", "Nested loop structure"],
    ["duplicates", "Duplication", "Repeated function body"],
  ]) {
    await page.getByLabel("Sample program").selectOption(sample);
    await analyze(page);
    await page.getByRole("tab", { name: /^Diagnostics/ }).click();
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: heading }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Resources", exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
  }
});

for (let run = 1; run <= 3; run++)
  test(`complete real-backend demo rehearsal ${run}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await ready(page);
    await expect(
      page.getByRole("heading", { name: "Your code has a story." }),
    ).toBeVisible();
    const report = await analyze(page);
    expect(report.data.summary).toMatchObject({
      functionCount: 1,
      securityFindings: 2,
      resourceWarnings: 0,
    });
    await expect(page.getByTestId("stat-security-findings")).toContainText("2");
    await page.getByRole("tab", { name: "Compiler", exact: true }).click();
    await page
      .getByRole("button", { name: "Function review_submission", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Function", exact: true }),
    ).toBeVisible();
    await page.getByText("Source connections", { exact: true }).click();
    await expect(
      page.getByText(/CFG blocks: review_submission:/),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Symbols", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "score", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Diagnostics", exact: false }).click();
    await page.getByRole("button", { name: "Security", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Unbounded formatted string input",
        exact: true,
      }),
    ).toBeVisible();
    const finding = report.data.modules.security.data.find(
      (f) => f.ruleId === "CS-SEC-005",
    );
    await page
      .getByRole("button", {
        name: `View line ${finding.range.line} in source`,
        exact: true,
      })
      .click();
    await expect(page.getByLabel("C source")).toBeFocused();
    await expect(page.locator(".source-location")).toContainText("scanf");
    expect(
      await page.evaluate(() => window.getSelection().toString()),
    ).toContain("scanf");
    await page.getByRole("tab", { name: "Optimization", exact: true }).click();
    await expect(section(page, "Optimized TAC")).toContainText("base@");
    await expect(section(page, "Transformation log")).toContainText(
      "CONSTANT FOLDING",
    );
    await page
      .locator("summary")
      .filter({ hasText: "Operands & effects" })
      .first()
      .click();
    await page.getByRole("tab", { name: "Control flow", exact: true }).click();
    await page
      .getByRole("button", { name: "Inspect block B0", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "B0", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(page.getByText("125%", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fit graph" }).click();
    await page.getByRole("button", { name: "Reset graph view" }).click();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Compiler", exact: true }).click();
    await page.getByRole("tab", { name: "Data flow", exact: true }).click();
    await expect(page.getByText(/Fixed point reached in/)).toBeVisible();
    await page.getByText("Iteration trace", { exact: true }).click();
    const trace = report.data.modules.dataFlow.data[0].liveVariables.trace;
    await page
      .getByLabel("Data flow round")
      .selectOption(String(trace.length - 1));
    await expect(
      page.getByText("No changes: the sets have reached a fixed point."),
    ).toBeVisible();
    await page
      .locator("summary")
      .filter({ hasText: "Additional analysis" })
      .click();
    await expect(page.getByTestId("stat-allocation-calls")).toContainText("1");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export JSON", exact: true })
      .click();
    const artifact = await download;
    expect(JSON.parse(await readFile(await artifact.path(), "utf8"))).toEqual(
      report,
    );
    expect(errors).toEqual([]);
  });

test("syntax error, unsupported preprocessing, and successful recovery", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Sample program").selectOption("syntax-error");
  const broken = await analyze(page);
  expect(broken.data.status).toBe("PARSE_ERROR");
  await expect(page.getByTestId("analysis-status")).toHaveText("Syntax error");
  await expect(page.getByRole("tabpanel")).toContainText("C-SYNTAX");
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "This stage has no published result" }),
  ).toBeVisible();
  await page.getByLabel("Sample program").selectOption("macros");
  expect((await analyze(page)).data.status).toBe("PARTIAL_ANALYSIS");
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  await expect(
    page.getByText(/Preprocessing could change this program/),
  ).toBeVisible();
  await page.getByLabel("Sample program").selectOption("bounded");
  expect((await analyze(page)).data.status).toBe("SUCCESS");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.getByTestId("stat-security-findings")).toContainText("0");
});

test("editing disables exports and source links, reanalysis restores them", async ({
  page,
}) => {
  await ready(page);
  await analyze(page);
  await page.getByLabel("C source").fill("int changed(void){return 9;}");
  await expect(
    page.getByText(/These results belong to the previous source/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export JSON", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /View line .* in source/ }).first(),
  ).toBeDisabled();
  const report = await analyze(page);
  expect(report.data.modules.ast.data.children[0].attributes.name).toBe(
    "changed",
  );
  await expect(
    page.getByRole("button", { name: "Export JSON", exact: true }),
  ).toBeEnabled();
});

test("superseded backend response cannot overwrite newer code", async ({
  page,
}) => {
  await ready(page);
  let release, arrived;
  const gate = new Promise((r) => (release = r)),
    reached = new Promise((r) => (arrived = r));
  let first = true;
  await page.route("**/api/analyze", async (route) => {
    const server = await route.fetch();
    if (first) {
      first = false;
      arrived();
      await gate;
    }
    try {
      await route.fulfill({ response: server });
    } catch {} // A superseded browser request is aborted.
  });
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  await reached;
  await expect(
    page.getByRole("heading", { name: "Making sense of your code" }),
  ).toBeVisible();
  await page.getByLabel("C source").fill("int latest(void){return 7;}");
  const latest = await analyze(page);
  release();
  expect(latest.data.modules.ast.data.children[0].attributes.name).toBe(
    "latest",
  );
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Function latest", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Function review_submission",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("upload preserves filename; reset, samples dialog, and help work", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Upload C file").setInputFiles({
    name: "lesson.c",
    mimeType: "text/plain",
    buffer: Buffer.from("int uploaded(void){return 3;}"),
  });
  await expect(
    page.getByRole("heading", { name: "lesson.c", exact: true }),
  ).toBeVisible();
  expect((await analyze(page)).data.sourceMetadata.filename).toBe("lesson.c");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Analyze code/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Your code has a story." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Samples", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Constant arithmetic/ })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("C source").press("ControlOrMeta+Enter");
  await expect(page.getByText("Result ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Live variables and reaching definitions",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
});

for (const width of [320, 768, 1440])
  test(`layout and selectable graphs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    await analyze(page);
    const fits = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      );
    expect(await fits()).toBe(true);
    await page.getByRole("tab", { name: "Control flow", exact: true }).click();
    await page
      .getByRole("button", { name: "Inspect block B0", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "B0", exact: true }),
    ).toBeVisible();
    expect(await fits()).toBe(true);
    await page.getByRole("tab", { name: "Optimization", exact: true }).click();
    await expect(section(page, "Optimized TAC")).toBeVisible();
    expect(await fits()).toBe(true);
  });

test("data flow trace, source connections, typed operands, and keyboard tabs", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Sample program").selectOption("arithmetic");
  const report = await analyze(page);
  expect(report.data.schemaVersion).toBe("1.1");
  expect(report.data.modules.dataFlow.data[0].liveVariables.converged).toBe(
    true,
  );
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /^Diagnostics/ })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Compiler", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Function calculate", exact: true })
    .click();
  await page.getByText("Source connections", { exact: true }).click();
  await expect(page.getByText(/CFG blocks: calculate: B0/)).toBeVisible();
  await page.getByRole("tab", { name: "Data flow", exact: true }).click();
  await expect(page.getByText(/Fixed point reached in/)).toBeVisible();
  await page
    .getByRole("button", { name: "Reaching definitions", exact: true })
    .click();
  await page.getByText("Iteration trace", { exact: true }).click();
  const last =
    report.data.modules.dataFlow.data[0].reachingDefinitions.trace.length - 1;
  await page.getByLabel("Data flow round").selectOption(String(last));
  await expect(
    page.getByText("No changes: the sets have reached a fixed point."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Optimization", exact: true }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Operands & effects" })
    .first()
    .click();
  await expect(page.getByText(/No value operands|int/).first()).toBeVisible();
});

test("request failures and excessive expressions recover without broken results", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await analyze(page);
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "Backend unavailable",
    }),
  );
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  await expect(page.getByRole("alert")).toContainText("unreadable response");
  await expect(
    page.getByRole("button", { name: "Export JSON" }),
  ).toBeDisabled();
  await page.unroute("**/api/analyze");
  await page
    .getByLabel("C source")
    .fill(`int f(void){return ${Array(600).fill("1").join("+")};}`);
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Analysis limit exceeded",
  );
  await page.getByLabel("Sample program").selectOption("bounded");
  expect((await analyze(page)).data.status).toBe("SUCCESS");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("request timeout is actionable and does not accept a late response", async ({
  page,
}) => {
  await ready(page);
  await page.clock.install();
  let arrived;
  const reached = new Promise((r) => (arrived = r));
  await page.route("**/api/analyze", async (route) => {
    arrived();
    await new Promise((r) => setTimeout(r, 1000));
    try {
      await route.abort();
    } catch {}
  });
  await page.getByRole("button", { name: /^Analyze code/ }).click();
  await reached;
  await page.clock.fastForward(20001);
  await expect(page.getByRole("alert")).toContainText("longer than 20 seconds");
  await expect(
    page.getByRole("button", { name: /^Analyze code/ }),
  ).toBeEnabled();
});

test("large token tables render a bounded page and retain access to every row", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByLabel("C source")
    .fill(
      Array.from(
        { length: 150 },
        (_, i) => `int f${i}(void){int x=1;return x;}`,
      ).join("\n"),
    );
  await analyze(page);
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  await page.getByRole("tab", { name: "Tokens", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(100);
  await expect(page.getByText("Rows 1–100 of 2250")).toBeVisible();
  await page.getByRole("button", { name: "Next rows" }).click();
  await expect(page.getByText("Rows 101–200 of 2250")).toBeVisible();
});

test("reduced motion, editor escape, and data flow fit a mobile screen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await analyze(page);
  await page.getByLabel("C source").focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("C source")).not.toBeFocused();
  await page.getByRole("tab", { name: "Compiler", exact: true }).click();
  await page.getByRole("tab", { name: "Data flow", exact: true }).click();
  await expect(page.getByText(/Fixed point reached in/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("easy guide links real arithmetic evidence to its detailed stages", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.getByRole("button", { name: "New to coding? Start here" }).click();
  await expect(page.getByRole("tabpanel")).toBeFocused();
  await page
    .getByRole("button", { name: "2. Little pieces", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open the real Tokens view" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Load tiny example" }).click();
  await expect(page.getByLabel("Sample program")).toHaveValue("arithmetic");
  await expect(page.getByLabel("C source")).toContainText(
    "int calculate(void)",
  );
  const report = await analyze(page);
  await expect(
    page.getByText("First pieces from your file", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open the real Tokens view" }).click();
  await expect(
    page.getByRole("tab", { name: "Tokens", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("cell", { name: "calculate", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Start here", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "First, find the little pieces",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "4. Named boxes", exact: true })
    .click();
  await expect(
    page.getByText("Names from your file", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open the real Symbols view" })
    .click();
  await expect(
    page.getByRole("tab", { name: "Symbols", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Start here", exact: true }).click();
  await page
    .getByRole("button", { name: "5. Small steps", exact: true })
    .click();
  await expect(
    page.getByText("First steps from calculate", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open the real Optimization view" })
    .click();
  await expect(section(page, "Optimized TAC")).toContainText("return 20");
  await page.getByRole("tab", { name: "Start here", exact: true }).click();
  await page
    .getByRole("button", { name: "7. Follow values", exact: true })
    .click();
  const flow = report.data.modules.dataFlow.data[0];
  await expect(page.getByRole("tabpanel")).toContainText(
    `live-variable sets settled in ${flow.liveVariables.rounds} rounds`,
  );
  await page
    .getByRole("button", { name: "Open the real Data flow view" })
    .click();
  await expect(page.getByText(/Fixed point reached in/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("easy guide hides stale and failed evidence and explains unavailable checks", async ({
  page,
}) => {
  await ready(page);
  const hero = await analyze(page);
  await page.getByRole("tab", { name: "Start here", exact: true }).click();
  await page
    .getByRole("button", { name: "8. Things to check", exact: true })
    .click();
  const finding = hero.data.findings.find((f) => f.ruleId === "CS-SEC-005");
  await expect(page.getByRole("tabpanel")).toContainText(finding.ruleName);
  await page
    .getByRole("button", {
      name: `Show line ${finding.range.line}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".source-location")).toContainText("scanf");
  await page.getByLabel("C source").fill("int changed(void){return 9;}");
  await expect(page.getByRole("tabpanel")).toContainText(
    "You changed the recipe",
  );
  await expect(page.getByRole("button", { name: /^Show line/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open the real Diagnostics view" }),
  ).toBeDisabled();
  await analyze(page);
  await page
    .getByRole("button", { name: "7. Follow values", exact: true })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText("sets settled");
  let release, arrived;
  const gate = new Promise((r) => (release = r)),
    reached = new Promise((r) => (arrived = r));
  await page.route("**/api/analyze", async (route) => {
    arrived();
    await gate;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: "Temporary backend failure",
      }),
    });
  });
  await page
    .getByRole("button", { name: "Analyze this code", exact: true })
    .click();
  await reached;
  await expect(page.getByRole("tabpanel")).toContainText(
    "Wait for its results",
  );
  await expect(page.getByRole("tabpanel")).not.toContainText("sets settled");
  release();
  await expect(page.getByRole("alert")).toContainText(
    "Temporary backend failure",
  );
  await expect(page.getByRole("tabpanel")).not.toContainText("sets settled");
  await expect(
    page.getByRole("button", { name: "Open the real Data flow view" }),
  ).toBeDisabled();
  await page.unroute("**/api/analyze");
  await page.getByLabel("Sample program").selectOption("macros");
  await analyze(page);
  await expect(page.getByRole("tabpanel")).toContainText(
    "No complete value-following result",
  );
  await page
    .getByRole("button", { name: "8. Things to check", exact: true })
    .click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "A missing answer does not mean zero problems",
  );
});

for (const width of [320, 768, 1440])
  test(`easy lessons and knowledge check at ${width}px`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    await page
      .getByRole("button", { name: "New to coding? Start here" })
      .click();
    await page.getByRole("button", { name: "Load tiny example" }).click();
    await analyze(page);
    for (const name of [
      "1. The recipe",
      "3. The tree",
      "6. The road map",
      "9. Your turn",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    await page
      .getByRole("button", { name: "Yes, it runs it", exact: true })
      .click();
    await expect(page.getByRole("tabpanel")).toContainText("Try again");
    await page
      .getByRole("button", { name: "No, it reads and checks it", exact: true })
      .click();
    await expect(page.getByRole("tabpanel")).toContainText("Exactly!");
    await expect(
      page.getByRole("button", { name: "Next idea", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "A warning says: take a closer look",
        exact: true,
      }),
    ).toBeVisible();
    // Current built app + real backend captures document the new journey.
    if (width === 1440 || width === 320) {
      await page
        .getByRole("button", { name: "3. The tree", exact: true })
        .click();
      await page.screenshot({
        path: `../output/playwright/easy-guide-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    expect(errors).toEqual([]);
  });
