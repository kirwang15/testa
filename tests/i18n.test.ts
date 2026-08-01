import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { runInNewContext } from "node:vm";
import { getActiveCluePresentation } from "../lib/clue-presentation";
import {
  getChineseTranslations,
  getTranslationKeys,
  translate
} from "../lib/i18n";
import { LANGUAGE_BOOTSTRAP_SCRIPT } from "../lib/language-bootstrap";

describe("typed bilingual presentation", () => {
  test("keeps English and Chinese dictionaries in exact key parity", () => {
    const keys = getTranslationKeys();
    const chinese = getChineseTranslations();

    assert.equal(keys.length > 100, true);
    assert.deepEqual(Object.keys(chinese).sort(), [...keys].sort());
    assert.equal(keys.every((key) => Boolean(chinese[key].trim())), true);
    assert.equal(translate("en", "common.levels", { count: 50 }), "50 levels");
    assert.equal(translate("zh-CN", "common.levels", { count: 50 }), "50 关");
  });

  test("returns only the selected clue language and defaults to English", () => {
    const meanings = {
      english: "A place where you learn.",
      chinese: "学习知识的地方。"
    };
    const english = getActiveCluePresentation("en", meanings, "fallback");
    const chinese = getActiveCluePresentation("zh-CN", meanings, "fallback");

    assert.deepEqual(english, {
      language: "en",
      text: meanings.english
    });
    assert.doesNotMatch(JSON.stringify(english), /学习知识/);
    assert.deepEqual(chinese, {
      language: "zh-CN",
      text: meanings.chinese
    });
    assert.doesNotMatch(JSON.stringify(chinese), /place where/);
  });

  test("renders one active clue card and no bilingual clue branch", () => {
    const slots = readFileSync("components/WordSlots.tsx", "utf8");
    const game = readFileSync("components/LevelGame.tsx", "utf8");

    assert.match(slots, /getActiveCluePresentation/);
    assert.match(slots, /activeWordId/);
    assert.match(slots, /onToggleClueLanguage/);
    assert.doesNotMatch(slots, /meaningDisplay|isBilingualView/);
    assert.doesNotMatch(game, /meaningDisplay="bilingual"|English and Chinese/);
    assert.match(game, /clueLanguage=\{activeProfile\.preferences\.clueLanguage\}/);
  });

  test("syncs html language from the active profile and removes MVP metadata", () => {
    const sync = readFileSync("components/AppLanguageSync.tsx", "utf8");
    const layout = readFileSync("app/layout.tsx", "utf8");
    const bootstrap = readFileSync("lib/language-bootstrap.ts", "utf8");

    assert.match(sync, /document\.documentElement\.lang/);
    assert.match(sync, /profile\.id/);
    assert.match(sync, /usePathname/);
    assert.match(sync, /language, pathname, profile\.id/);
    assert.match(sync, /MutationObserver/);
    assert.doesNotMatch(layout, /MVP/);
    assert.match(layout, /AppLanguageSync/);
    assert.match(layout, /<html lang="zh-CN"/);
    assert.match(layout, /Word Trail · 单词冒险/);
    assert.match(layout, /LANGUAGE_BOOTSTRAP_SCRIPT/);
    assert.match(bootstrap, /localStorage\.getItem\("word-trail-mvp-progress"\)/);
    assert.match(bootstrap, /preferences\.uiLanguage/);
    assert.match(bootstrap, /outer>3/);
    assert.match(bootstrap, /inner>3/);
    assert.match(bootstrap, /outer!==inner/);
    assert.doesNotMatch(bootstrap, /targetWords|englishMeaning|chineseMeaning|displayText/);
  });

  test("bootstrap never trusts language preferences from a future save", () => {
    const execute = (raw: string) => {
      const document = {
        documentElement: { lang: "zh-CN" },
        title: "Word Trail · 单词冒险"
      };
      runInNewContext(LANGUAGE_BOOTSTRAP_SCRIPT, {
        document,
        localStorage: { getItem: () => raw }
      });
      return document;
    };
    const englishState = {
      activeProfileId: "child",
      profiles: {
        child: { preferences: { uiLanguage: "en" } }
      }
    };

    assert.equal(
      execute(JSON.stringify({ version: 3, state: englishState })).documentElement.lang,
      "en"
    );
    assert.equal(
      execute(JSON.stringify({ version: 999, state: englishState })).documentElement.lang,
      "zh-CN"
    );
    assert.equal(
      execute(
        JSON.stringify({
          version: 3,
          state: { ...englishState, storageVersion: 999 }
        })
      ).documentElement.lang,
      "zh-CN"
    );
    assert.equal(
      execute(
        JSON.stringify({
          version: 2,
          state: { ...englishState, storageVersion: 3 }
        })
      ).documentElement.lang,
      "zh-CN"
    );
  });

  test("keys level and review sessions by profile as well as route", () => {
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const review = readFileSync("app/review/page.tsx", "utf8");

    assert.match(game, /sessionProfileId/);
    assert.match(game, /activeProfileId/);
    assert.match(game, /level\.id/);
    assert.match(game, /speechRequestTokenRef\.current \+= 1/);
    assert.match(review, /activeProfile\.id}:review/);
    assert.match(review, /\[activeProfile\.id\]/);
  });
});
