import { expect, test, type Page } from "@playwright/test";

const ageBands = ["7-9", "10-12", "13-15"] as const;

async function finishGuidedOnboarding(page: Page, ageBand = "10-12") {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "选择你的冒险方式" })).toBeVisible();
  await page.getByRole("textbox", { name: "昵称" }).fill(`试玩-${ageBand}`);
  await page.getByRole("button", { name: `${ageBand} 岁`, exact: true }).click();
  await page.getByRole("button", { name: /中文引导/ }).click();
  await page.getByRole("button", { name: "开始第一次冒险", exact: true }).click();
  await expect(page.getByRole("heading", { name: "继续单词之旅" })).toBeVisible();
}

async function chooseAvailableLetters(page: Page, letters: string) {
  for (const letter of letters) {
    const candidates = page
      .locator("button.game-letter-button")
      .filter({ hasText: new RegExp(`^${letter}$`) });
    let clicked = false;
    for (let index = 0; index < (await candidates.count()); index += 1) {
      const candidate = candidates.nth(index);
      if (await candidate.isEnabled()) {
        await candidate.click();
        clicked = true;
        break;
      }
    }
    expect(clicked, `an enabled ${letter} tile should exist`).toBe(true);
  }
}

async function submitClue(page: Page, clueName: RegExp, missingLetters: string) {
  const clue = page.getByRole("button", { name: clueName });
  if (await clue.isEnabled()) await clue.click();
  await chooseAvailableLetters(page, missingLetters);
  const submit = page.getByRole("button", { name: "提交当前单词" });
  await expect(submit).toBeEnabled();
  await submit.click();
}

async function solveDemoLevel(page: Page) {
  await submitClue(page, /提示 1 · 横向 · 4/, "WHAT");
  await submitClue(page, /提示 2 · 纵向 · 4/, "ERE");
  await submitClue(page, /提示 3 · 横向 · 5/, "SORY");
}

for (const ageBand of ageBands) {
  test(`${ageBand} learner can enter the first adventure without help`, async ({ page }) => {
    await finishGuidedOnboarding(page, ageBand);
    await page.locator('a[href="/levels/nce-1997-b1-level-001"]').click();
    await expect(page.getByRole("grid", { name: /填字棋盘/ })).toBeVisible();
    await expect(page.getByText("Question word asking for a thing", { exact: true })).toBeVisible();
  });
}

test("mobile home stays within two screens and controls remain touch safe", async ({ page }) => {
  await finishGuidedOnboarding(page);
  const measurements = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
    smallControls: [...document.querySelectorAll("button,a,input,select,textarea")]
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44))
      .length
  }));
  expect(measurements.height).toBeLessThanOrEqual(1688);
  expect(measurements.width).toBeLessThanOrEqual(390);
  expect(measurements.smallControls).toBe(0);
});

test("clue language is single-language and the unresolved answer stays out of DOM attributes", async ({ page }) => {
  await finishGuidedOnboarding(page);
  await page.locator('a[href="/levels/nce-1997-b1-level-001"]').click();
  await expect(page.getByText("Question word asking for a thing", { exact: true })).toBeVisible();
  await expect(page.getByText("什么", { exact: true })).toHaveCount(0);

  const beforeToggle = await page.evaluate(() => ({
    bodyText: document.body.textContent ?? "",
    attributeLeak: [...document.querySelectorAll("*")].some((element) =>
      [...element.attributes].some((attribute) => /\bWHAT\b/i.test(attribute.value))
    )
  }));
  expect(beforeToggle.bodyText).not.toMatch(/\bWHAT\b/i);
  expect(beforeToggle.attributeLeak).toBe(false);

  await page.getByRole("button", { name: "显示中文提示" }).click();
  await expect(page.getByText("什么", { exact: true })).toBeVisible();
  await expect(page.getByText("Question word asking for a thing", { exact: true })).toHaveCount(0);
});

test("completion, next-level, map, and replay rewards form one truthful loop", async ({ page }) => {
  await finishGuidedOnboarding(page);
  await page.locator('a[href="/levels/nce-1997-b1-level-001"]').click();
  await solveDemoLevel(page);
  await expect(page.locator('[aria-label="125 金币"]')).toBeVisible();
  await expect(page.locator('a[href="/levels/nce-1997-b1-level-002"]')).toBeVisible();
  await expect(page.locator('a[href="/map"]')).toBeVisible();

  await page.getByRole("button", { name: "重新挑战本关" }).click();
  await expect(page.getByText("0/3", { exact: true }).first()).toBeVisible();
  await solveDemoLevel(page);
  await expect(page.locator('[aria-label="125 金币"]')).toBeVisible();
});

test("friend-demo support routes render without dead ends", async ({ page }) => {
  await finishGuidedOnboarding(page);
  for (const route of ["/map", "/review", "/parent", "/settings"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText(/404|页面不存在|not found/i)).toHaveCount(0);
  }
});
