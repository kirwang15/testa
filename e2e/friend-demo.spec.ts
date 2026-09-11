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

async function enterGuidedFirstLevel(page: Page) {
  await page.getByRole("button", { name: "下一步：认识地图" }).click();
  await expect(page.getByRole("heading", { name: "看懂课程地图" })).toBeVisible();
  await page.getByRole("button", { name: "开始带指引的第一关" }).click();
  await expect(page.getByRole("grid", { name: /填字棋盘/ })).toBeVisible();
}

async function chooseAvailableLetters(page: Page, letters: string) {
  for (const letter of letters) {
    await expect(
      page.locator("button.game-letter-button:not([disabled])").first()
    ).toBeVisible();
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

async function persistedState(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("word-trail-mvp-progress");
    if (!raw) throw new Error("game storage is missing");
    return JSON.parse(raw).state;
  });
}

async function markTutorialCompleted(page: Page) {
  await page.evaluate(() => {
    const key = "word-trail-mvp-progress";
    const envelope = JSON.parse(localStorage.getItem(key) ?? "null");
    const profileId = envelope.state.activeProfileId;
    envelope.state.profiles[profileId].tutorialProgress = {
      version: 1,
      status: "completed",
      phase: "completed",
      tutorialLevelId: "nce-1997-b1-level-001",
      firstWordDetailSeen: true,
      collapsed: false
    };
    localStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.reload();
}

async function submitClue(page: Page, clueName: RegExp, missingLetters: string) {
  const clue = page.getByRole("button", { name: clueName });
  if (await clue.isEnabled()) await clue.click();
  await chooseAvailableLetters(page, missingLetters);
  await expect(page.getByText(/找到一个单词|关卡完成/).last()).toBeVisible();
}

async function solveDemoLevel(page: Page) {
  await submitClue(page, /提示 1 · 横向 · 4/, "WHAT");
  await submitClue(page, /提示 2 · 纵向 · 4/, "ERE");
  await submitClue(page, /提示 3 · 横向 · 5/, "SORY");
}

for (const ageBand of ageBands) {
  test(`${ageBand} learner can enter the first adventure without help`, async ({ page }) => {
    await finishGuidedOnboarding(page, ageBand);
    await enterGuidedFirstLevel(page);
    await expect(page.getByRole("grid", { name: /填字棋盘/ })).toBeVisible();
    await expect(page.getByText("Question word asking for a thing", { exact: true })).toBeVisible();
  });
}

test("desktop letter wheel is spacious and pronunciation never consumes a letter hint", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1000, "desktop layout only");
  await finishGuidedOnboarding(page);
  await enterGuidedFirstLevel(page);

  const shell = page.locator(".game-wheel-shell");
  await expect(shell).toBeVisible();
  const shellBox = await shell.boundingBox();
  expect(shellBox?.width).toBeGreaterThanOrEqual(300);

  const boxes = await page.locator("button.game-letter-button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    })
  );
  const overlaps: Array<{ left: number; right: number; overlapWidth: number; overlapHeight: number }> = [];
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left];
      const b = boxes[right];
      const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapWidth > 1 && overlapHeight > 1) {
        overlaps.push({ left, right, overlapWidth, overlapHeight });
      }
    }
  }
  expect(overlaps).toEqual([]);

  await expect(page.locator(".game-grid-tile-hinted")).toHaveCount(0);
  const listen = page.getByRole("button", { name: "播放发音提示" });
  await expect(listen).toBeEnabled();
  await listen.click();
  await listen.click();
  await expect(listen).toBeEnabled();
  await expect(page.locator(".game-grid-tile-hinted")).toHaveCount(0);

  const letterHint = page.getByRole("button", { name: /揭示首字母/ });
  await expect(letterHint).toBeEnabled();
  await letterHint.click();
  await expect(page.locator(".game-grid-tile-hinted")).toHaveCount(1);
});

test("mobile tutorial home remains scrollable without clipping and controls stay touch safe", async ({ page }) => {
  await finishGuidedOnboarding(page);
  const measurements = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
    smallControls: [...document.querySelectorAll("button,a,input,select,textarea")]
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44))
      .length
  }));
  expect(measurements.height).toBeGreaterThanOrEqual(page.viewportSize()?.height ?? 844);
  expect(measurements.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 390);
  expect(measurements.smallControls).toBe(0);
  const nextStep = page.getByRole("button", { name: "下一步：认识地图" });
  await nextStep.scrollIntoViewIfNeeded();
  await expect(nextStep).toBeVisible();
});

test("clue language is single-language and the unresolved answer stays out of DOM attributes", async ({ page }) => {
  await finishGuidedOnboarding(page);
  await enterGuidedFirstLevel(page);
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
  await enterGuidedFirstLevel(page);
  await submitClue(page, /提示 1 · 横向 · 4/, "WHAT");
  await page.getByRole("button", { name: /提示 1 · 横向 · 4/ }).click();
  await expect(page.getByRole("button", { name: "继续下一个单词" })).toBeVisible();
  await page.getByRole("button", { name: "继续下一个单词" }).click();
  await submitClue(page, /提示 2 · 纵向 · 4/, "ERE");
  await submitClue(page, /提示 3 · 横向 · 5/, "SORY");
  await expect(page.locator('[aria-label="125 金币"]')).toBeVisible();
  await expect(page.locator('a[href^="/levels/nce-1997-b1-level-002?"]')).toBeVisible();
  await expect(page.locator('a[href="/map"]')).toBeVisible();
  await page.getByRole("button", { name: "完成第一次冒险指引" }).click();
  await expect(page.getByTestId("tutorial-coach")).toHaveCount(0);

  await page.getByRole("button", { name: "重玩本关" }).click();
  await expect(page.getByText("0/3", { exact: true }).first()).toBeVisible();
  await solveDemoLevel(page);
  await expect(page.locator('[aria-label="125 金币"]')).toBeVisible();
});

test("level exits preserve each real entry surface and a direct-link fallback", async ({ page }) => {
  await finishGuidedOnboarding(page);
  await markTutorialCompleted(page);

  const cases = [
    {
      entry: "/",
      levelLink: 'a[href^="/levels/"][href*="returnTo=%2F"]',
      expected: /\/$/
    },
    {
      entry: "/courses/ielts-nawl-v1",
      levelLink: 'a[href^="/levels/ielts-nawl-v1-level-001?"]',
      expected: /\/courses\/ielts-nawl-v1$/
    },
    {
      entry: "/map?book=nce-1997-b2",
      levelLink: 'a[href*="returnTo=%2Fmap%3Fbook%3Dnce-1997-b2"]',
      expected: /\/map\?book=nce-1997-b2$/
    },
    {
      entry: "/books/nce-1997-b1/units/nce-1997-b1-u1",
      levelLink: 'a[href^="/levels/"][href*="returnTo=%2Fbooks%2Fnce-1997-b1%2Funits%2Fnce-1997-b1-u1"]',
      expected: /\/books\/nce-1997-b1\/units\/nce-1997-b1-u1$/
    }
  ];

  for (const scenario of cases) {
    await page.goto(scenario.entry);
    await page.locator(scenario.levelLink).first().click();
    await expect(page.getByRole("grid", { name: /填字棋盘/ })).toBeVisible();
    await page.getByRole("link", { name: "返回进入关卡前的页面" }).click();
    await expect(page).toHaveURL(scenario.expected);
  }

  await page.goto("/levels/ielts-nawl-v1-level-001");
  await page.getByRole("link", { name: "返回进入关卡前的页面" }).click();
  await expect(page).toHaveURL(/\/courses\/ielts-nawl-v1$/);

  await page.goto("/map?book=nce-1997-b1");
  await page.locator('a[href^="/levels/nce-1997-b1-level-001?"]').click();
  await solveDemoLevel(page);
  await page.locator('a[href^="/levels/nce-1997-b1-level-002?"]').click();
  await expect(page).toHaveURL(/\/levels\/nce-1997-b1-level-002\?returnTo=%2Fmap%3Fbook%3Dnce-1997-b1$/);
  await page.getByRole("link", { name: "返回进入关卡前的页面" }).click();
  await expect(page).toHaveURL(/\/map\?book=nce-1997-b1$/);
});

test("automatic validation keeps a wrong draft, retries once, and makes solved detail read-only", async ({ page }) => {
  await finishGuidedOnboarding(page);
  await markTutorialCompleted(page);
  await page.goto("/levels/nce-1997-b1-level-001?returnTo=%2Fmap%3Fbook%3Dnce-1997-b1");

  await chooseAvailableLetters(page, "WHAR");
  await expect(page.getByText("这个拼写不在本关中。", { exact: true })).toBeVisible();
  await expect(page.locator(".game-word-ribbon")).toContainText("WHAR");
  await expect(page.locator(".game-crossword-grid .bg-red-700")).toHaveCount(4);
  let state = await persistedState(page);
  const profileId = state.activeProfileId;
  expect(state.progressByProfileId[profileId].levels["nce-1997-b1-level-001"].wrongAttempts).toBe(1);
  await page.waitForTimeout(700);
  state = await persistedState(page);
  expect(state.progressByProfileId[profileId].levels["nce-1997-b1-level-001"].wrongAttempts).toBe(1);

  await page.getByRole("button", { name: "移除最后一个字母" }).click();
  await chooseAvailableLetters(page, "T");
  await expect(page.getByText("找到一个单词。", { exact: true })).toBeVisible();
  state = await persistedState(page);
  const levelBeforeDetail = state.progressByProfileId[profileId].levels["nce-1997-b1-level-001"];
  expect(levelBeforeDetail.foundWords).toHaveLength(1);

  await page.getByRole("button", { name: /提示 1 · 横向 · 4/ }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: /^WHAT$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "继续下一个单词" })).toBeVisible();
  await expect(page.locator("button.game-letter-button:not([disabled])")).toHaveCount(0);
  await page.waitForTimeout(700);
  state = await persistedState(page);
  expect(state.progressByProfileId[profileId].levels["nce-1997-b1-level-001"]).toEqual(levelBeforeDetail);
});

test("tutorial pause and reload never complete it before first-level completion", async ({ page }) => {
  await finishGuidedOnboarding(page);
  await page.getByRole("button", { name: "稍后继续" }).click();
  await expect(page.getByRole("button", { name: "继续新手第一关" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "继续新手第一关" })).toBeVisible();
  let state = await persistedState(page);
  let profileId = state.activeProfileId;
  expect(state.profiles[profileId].tutorialProgress.status).toBe("in-progress");

  await page.getByRole("button", { name: "继续新手第一关" }).click();
  await page.getByRole("button", { name: "下一步：认识地图" }).click();
  await page.getByRole("button", { name: "开始带指引的第一关" }).click();
  await chooseAvailableLetters(page, "WHAT");
  await page.getByRole("link", { name: "稍后继续" }).click();
  await page.goto("/");
  await page.reload();
  state = await persistedState(page);
  profileId = state.activeProfileId;
  expect(state.profiles[profileId].tutorialProgress).toMatchObject({
    status: "in-progress",
    phase: "first-word-detail",
    firstWordDetailSeen: false
  });

  await page.getByRole("button", { name: "继续新手第一关" }).click();
  await page.getByRole("button", { name: "下一步：认识地图" }).click();
  await page.getByRole("button", { name: "开始带指引的第一关" }).click();
  await page.getByRole("button", { name: /提示 1 · 横向 · 4/ }).click();
  await page.getByRole("button", { name: "继续下一个单词" }).click();
  await submitClue(page, /提示 2 · 纵向 · 4/, "ERE");
  await submitClue(page, /提示 3 · 横向 · 5/, "SORY");
  state = await persistedState(page);
  expect(state.profiles[profileId].tutorialProgress.status).toBe("in-progress");
  expect(state.profiles[profileId].tutorialProgress.phase).toBe("level-complete");
  await page.getByRole("button", { name: "完成第一次冒险指引" }).click();
  state = await persistedState(page);
  expect(state.profiles[profileId].tutorialProgress.status).toBe("completed");

  const beforeReference = JSON.stringify(state.profiles[profileId].tutorialProgress);
  await page.goto("/settings");
  await page.locator('a[href="/tutorial"]').click();
  await expect(page.getByRole("heading", { name: "完整操作说明" })).toBeVisible();
  state = await persistedState(page);
  expect(JSON.stringify(state.profiles[profileId].tutorialProgress)).toBe(beforeReference);
});

test("friend-demo support routes render without dead ends", async ({ page }) => {
  await finishGuidedOnboarding(page);
  for (const route of ["/map", "/review", "/parent", "/settings"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText(/404|页面不存在|not found/i)).toHaveCount(0);
  }
});
