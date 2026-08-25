import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "选择你的冒险方式" })).toBeVisible();
  await page.getByRole("button", { name: "10-12 岁", exact: true }).click();
  await page.getByRole("button", { name: /中文引导/ }).click();
  const nickname = page.getByRole("textbox", { name: "昵称" });
  await nickname.fill("网页验收");
  await expect(nickname).toHaveValue("网页验收");
  const start = page.getByRole("button", { name: "开始第一次冒险", exact: true });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByRole("heading", { name: "继续单词之旅" })).toBeVisible();
}

async function activeAssessmentSnapshot(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith("word-trail-web-assessment-v1:")
    );
    if (!key) throw new Error("assessment storage key missing");
    return JSON.parse(localStorage.getItem(key) ?? "null").active;
  });
}

test("Web exposes all courses and the assessment interaction", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await onboard(page);
  await expect(page.getByText("6–10 分钟测词汇量", { exact: true })).toBeVisible();
  await expect(page.getByText("52–80 题自适应估算，全程离线。", { exact: true })).toBeVisible();
  await expect(page.getByText("新概念英语", { exact: true })).toBeVisible();
  await expect(page.getByText("IELTS 备考词汇", { exact: true })).toBeVisible();
  await expect(page.getByText("考研核心词汇·起步篇", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("web-home-3-courses.png"), fullPage: true });

  await page.getByRole("link", { name: /IELTS 备考词汇/ }).click();
  const firstIeltsLevel = page.locator('a[href^="/levels/ielts-nawl-v1-level-001?"]').first();
  await expect(firstIeltsLevel).toBeVisible();
  await firstIeltsLevel.click();
  await expect(page.locator("button.game-letter-button").first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /考研核心词汇·起步篇/ }).click();
  const firstKaoyanLevel = page.locator('a[href^="/levels/kaoyan-core-v1-level-001?"]').first();
  await expect(firstKaoyanLevel).toBeVisible();
  await firstKaoyanLevel.click();
  await expect(page.locator("button.game-letter-button").first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: /6–10 分钟测词汇量/ }).click();
  await page.getByRole("button", { name: "不限定范围", exact: true }).click();
  await page.getByRole("button", { name: "开始估算", exact: true }).click();
  const word = page.locator("main h1");
  await expect(word).toBeVisible();
  const firstWord = (await word.textContent())!.trim();
  expect(firstWord).toBe(firstWord.toLocaleLowerCase("en"));

  const initialResponseCount = (await activeAssessmentSnapshot(page)).responses.length;
  await page.getByRole("button", { name: "认识", exact: true }).click();
  await expect(page.getByText("回答正确", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/正确答案/)).toHaveCount(0);
  await expect(page.locator("main .bg-emerald-600, main .bg-red-600")).toHaveCount(0);
  await expect.poll(async () => (await activeAssessmentSnapshot(page)).responses.length)
    .toBe(initialResponseCount + 1);
  await expect(word).not.toHaveText(firstWord, { timeout: 2_000 });
  await page.screenshot({ path: testInfo.outputPath("assessment-silent-answer.png"), fullPage: true });

  const secondWord = (await word.textContent())!.trim();
  await page.getByRole("button", { name: "不确定", exact: true }).click();
  await expect(page.getByText(/回答错误|正确答案/)).toHaveCount(0);
  await expect(page.locator("main .bg-emerald-600, main .bg-red-600")).toHaveCount(0);
  await expect.poll(async () => (await activeAssessmentSnapshot(page)).responses.length)
    .toBe(initialResponseCount + 2);
  await expect(word).not.toHaveText(secondWord, { timeout: 2_000 });
  const resumedWord = (await word.textContent())!.trim();
  const beforePause = await activeAssessmentSnapshot(page);
  await page.getByRole("button", { name: "暂停测试" }).click();
  await page.getByRole("button", { name: "保存并退出" }).click();
  await page.getByRole("link", { name: /6–10 分钟测词汇量/ }).click();
  expect(await activeAssessmentSnapshot(page)).toEqual(beforePause);
  await page.getByRole("button", { name: "继续未完成测试" }).click();
  expect(await activeAssessmentSnapshot(page)).toEqual(beforePause);
  await expect(word).toHaveText(resumedWord);

  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith("word-trail-web-assessment-v1:")
    );
    if (!key) throw new Error("assessment storage key missing");
    localStorage.setItem(key, JSON.stringify({
      history: [{
        sessionId: "e2e-invalid-result",
        selectedAnchor: "ielts",
        bankVersion: "assessment-proxy-v1-e2e",
        seed: 1,
        phase: "complete",
        responses: [{
          itemId: "legacy-e2e-word",
          itemType: "realWord",
          frequencyBand: 8,
          targetTags: ["advanced"],
          questionType: "yesNo",
          phase: "broad",
          recognized: true,
          correct: true,
          skipped: false,
          responseTimeMs: 1200,
          scored: true,
          lowEffort: false
        }],
        theta: 0,
        standardError: 0.4,
        estimate: 7200,
        estimateLower: 6100,
        estimateUpper: 8400,
        reliability: "invalid",
        coverage: { basic: 0.7, advanced: 0.5, target: 0.6 },
        estimateHistory: [7200],
        startedAt: "2026-08-13T00:00:00.000Z",
        durationMs: 180000
      }]
    }));
  });
  await page.goto("/assessment/result");
  await expect(page.getByText("估算词汇量：6,100–8,400 词", { exact: true })).toBeVisible();
  await expect(page.getByText("约 7,200 词", { exact: true })).toBeVisible();
  await expect(page.getByText("本次结果不稳定", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("assessment-clear-range.png"), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("a real browser assessment finishes in 52–80 silent screens", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByRole("link", { name: /6–10 分钟测词汇量/ }).click();
  await page.getByRole("button", { name: "不限定范围", exact: true }).click();
  await page.getByRole("button", { name: "开始估算", exact: true }).click();

  for (let screen = 0; screen < 80 && !page.url().endsWith("/assessment/result"); screen += 1) {
    const word = page.locator("main h1");
    await expect(word).toBeVisible();
    const spelling = (await word.textContent())!.trim();
    expect(spelling).toBe(spelling.toLocaleLowerCase("en"));
    await expect(page.getByText(/回答正确|回答错误|正确答案/)).toHaveCount(0);
    expect(await page.locator("html").getAttribute("data-correct-answer")).toBeNull();

    // Never create three consecutive low-effort answers: the test should
    // validate the normal 52–80 policy, not the deliberate anti-random-tap path.
    if (screen % 3 === 2) await page.waitForTimeout(520);
    const yes = page.getByRole("button", { name: "认识", exact: true });
    const choiceA = page.locator("main section button").filter({
      has: page.locator("span.text-coral")
    }).first();
    const resultHeading = page.getByRole("heading", { name: "你的词汇量范围" });
    await expect(yes.or(choiceA).or(resultHeading)).toBeVisible();
    if (await resultHeading.isVisible()) break;
    const answer = (await yes.isVisible()) ? yes : choiceA;
    const classBefore = await answer.getAttribute("class");
    await answer.click();
    expect(await answer.getAttribute("class")).toBe(classBefore);
    await expect(page.getByText(/回答正确|回答错误|正确答案/)).toHaveCount(0);
    await page.waitForTimeout(220);
  }

  await expect(page).toHaveURL(/\/assessment\/result$/);
  const result = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith("word-trail-web-assessment-v1:")
    );
    if (!key) throw new Error("assessment storage key missing");
    return JSON.parse(localStorage.getItem(key) ?? "null").history[0];
  });
  expect(result.responses.length).toBeGreaterThanOrEqual(52);
  expect(result.responses.length).toBeLessThanOrEqual(80);
  expect(result.responses.slice(-4).every((response: { phase: string; scored: boolean }) =>
    response.phase === "wrapUp" && response.scored === false
  )).toBe(true);
  await expect(page.getByText(/^估算词汇量：[\d,]+–[\d,]+ 词$/)).toBeVisible();
  await expect(page.getByText(/^约 [\d,]+ 词$/)).toBeVisible();
});
