import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  getRuntimeLevelById,
  getRuntimeVocabularyWordById,
  loadLevelRuntimeBundle,
  loadRuntimeVocabularyWord,
  loadRuntimeVocabularyWords,
  resetRuntimeContentForTests,
  toRuntimeFileKey,
  toRuntimeLevelId,
  validateLevelRuntimeBundle,
  validateRuntimeVocabularyWordBundle
} from "../lib/content-runtime";
import curriculumIndex from "../src/content/vocabulary/generated/curriculum-index.json";
import generatedContentManifest from "../src/content/vocabulary/generated/content-manifest.json";
import ratingOverrides from "../src/content/vocabulary/content-ratings.json";
import { contentManifest } from "../src/content/vocabulary";
import { GAME_CONTENT_VERSION } from "../lib/storage";
import type {
  LevelRuntimeBundle,
  RuntimeVocabularyWordBundle
} from "../types/game";

const level: LevelRuntimeBundle["level"] = {
  id: "runtime-test-level",
  bookId: "runtime-test-book",
  unitId: "runtime-test-unit",
  title: "Runtime test",
  letters: ["A", "C", "T"],
  targetWords: [
    {
      id: "runtime-test-cat",
      word: "cat",
      clue: "A small pet",
      start: { row: 0, col: 0 },
      direction: "across"
    }
  ],
  grid: { rows: 1, cols: 3 },
  rewardCoins: 0
};

const bundle: LevelRuntimeBundle = {
  contentVersion: curriculumIndex.contentVersion,
  level,
  vocabulary: [],
  releaseStatus: "automated-beta",
  rating: "all-ages"
};

describe("isolated runtime content delivery", () => {
  test("loads and registers only a validated matching level bundle", async () => {
    resetRuntimeContentForTests();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify(bundle));
    try {
      const loaded = await loadLevelRuntimeBundle(
        level.id,
        curriculumIndex.contentVersion
      );
      assert.equal(loaded.level.id, level.id);
      assert.equal(getRuntimeLevelById(level.id)?.id, level.id);
    } finally {
      globalThis.fetch = originalFetch;
      resetRuntimeContentForTests();
    }
  });

  test("preserves old Legacy URLs while loading their canonical bundle", async () => {
    const originalFetch = globalThis.fetch;
    const legacyAlias = "nce-1-u1-level-1";
    const canonicalId = toRuntimeLevelId(legacyAlias);
    globalThis.fetch = async (input) => {
      assert.match(String(input), new RegExp(toRuntimeFileKey(canonicalId)));
      return new Response(
        JSON.stringify({ ...bundle, level: { ...level, id: canonicalId } })
      );
    };
    try {
      const loaded = await loadLevelRuntimeBundle(
        legacyAlias,
        curriculumIndex.contentVersion
      );
      assert.equal(loaded.level.id, canonicalId);
    } finally {
      globalThis.fetch = originalFetch;
      resetRuntimeContentForTests();
    }
  });

  test("rejects missing and malformed or mismatched runtime responses", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response("missing", { status: 404 });
      await assert.rejects(
        loadLevelRuntimeBundle(level.id, curriculumIndex.contentVersion),
        /unavailable/
      );

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ ...bundle, level: { ...level, id: "other" } }));
      await assert.rejects(
        loadLevelRuntimeBundle(level.id, curriculumIndex.contentVersion),
        /validation/
      );
      assert.equal(getRuntimeLevelById(level.id), undefined);
    } finally {
      globalThis.fetch = originalFetch;
      resetRuntimeContentForTests();
    }
  });

  test("passes AbortSignal through so stale level requests can be cancelled", async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      });
    try {
      const pending = loadLevelRuntimeBundle(
        level.id,
        curriculumIndex.contentVersion,
        controller.signal
      );
      controller.abort();
      await assert.rejects(pending, (error: unknown) =>
        error instanceof DOMException && error.name === "AbortError"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("fails soft when one or more review word files are unavailable", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("offline");
    };
    try {
      assert.deepEqual(
        await loadRuntimeVocabularyWords(["missing-one", "missing-two"], "v1"),
        []
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("requires every word payload to authenticate the requested current release", async () => {
    const firstLevel = curriculumIndex.levels[0];
    const levelBundle = JSON.parse(
      readFileSync(
        `public/content/runtime/levels/${toRuntimeFileKey(firstLevel.id)}.json`,
        "utf8"
      )
    ) as LevelRuntimeBundle;
    const word = levelBundle.vocabulary[0];
    assert.ok(word);
    const valid: RuntimeVocabularyWordBundle = {
      contentVersion: curriculumIndex.contentVersion,
      word
    };
    assert.equal(
      validateRuntimeVocabularyWordBundle(
        valid,
        word.id,
        curriculumIndex.contentVersion
      ),
      true
    );
    assert.equal(
      validateRuntimeVocabularyWordBundle(word, word.id, curriculumIndex.contentVersion),
      false,
      "a legacy flat word file must not borrow the query-string version"
    );
    assert.equal(
      validateRuntimeVocabularyWordBundle(
        { ...valid, contentVersion: "previous-release" },
        word.id,
        curriculumIndex.contentVersion
      ),
      false
    );

    const originalFetch = globalThis.fetch;
    try {
      resetRuntimeContentForTests();
      globalThis.fetch = async () => new Response(JSON.stringify(word));
      assert.equal(
        await loadRuntimeVocabularyWord(word.id, curriculumIndex.contentVersion),
        undefined
      );
      assert.equal(getRuntimeVocabularyWordById(word.id), undefined);

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ ...valid, contentVersion: "previous-release" }));
      assert.equal(
        await loadRuntimeVocabularyWord(word.id, curriculumIndex.contentVersion),
        undefined
      );
      assert.equal(getRuntimeVocabularyWordById(word.id), undefined);

      globalThis.fetch = async () => new Response(JSON.stringify(valid));
      assert.equal(
        (await loadRuntimeVocabularyWord(word.id, curriculumIndex.contentVersion))?.id,
        word.id
      );
    } finally {
      globalThis.fetch = originalFetch;
      resetRuntimeContentForTests();
    }
  });

  test("publishes an answer-free 4/20/200 index and isolated files", () => {
    assert.equal(curriculumIndex.books.length, 4);
    assert.equal(curriculumIndex.units.length, 20);
    assert.equal(curriculumIndex.levels.length, 200);
    const serialized = JSON.stringify(curriculumIndex);
    assert.doesNotMatch(serialized, /englishMeaning|chineseMeaning|targetWords|wordIds|letters/);
    assert.doesNotMatch(serialized, /nce-1997-b1-what|Question word asking for a thing/);

    const first = curriculumIndex.levels[0];
    const runtime = JSON.parse(
      readFileSync(
        `public/content/runtime/levels/${toRuntimeFileKey(first.id)}.json`,
        "utf8"
      )
    ) as LevelRuntimeBundle;
    assert.equal(runtime.level.id, first.id);
    assert.equal(runtime.level.targetWords.length, first.wordCount);
    assert.equal(runtime.contentVersion, curriculumIndex.contentVersion);

    const wordFiles = readdirSync("public/content/runtime/words");
    assert.equal(wordFiles.length, 899);
    for (const file of wordFiles) {
      const payload: unknown = JSON.parse(
        readFileSync(`public/content/runtime/words/${file}`, "utf8")
      );
      assert.equal(
        typeof payload === "object" &&
          payload !== null &&
          "word" in payload &&
          typeof payload.word === "object" &&
          payload.word !== null &&
          "id" in payload.word &&
          typeof payload.word.id === "string" &&
          validateRuntimeVocabularyWordBundle(
            payload,
            payload.word.id,
            curriculumIndex.contentVersion
          ),
        true,
        file
      );
    }
  });

  test("derives one deterministic content identity from every mutable input", () => {
    const sha256 = (value: string | Buffer) =>
      `sha256:${createHash("sha256").update(value).digest("hex")}`;
    const sha256File = (path: string) => sha256(readFileSync(path));
    const manifest = generatedContentManifest;
    const expectedInputHashes = {
      baseContent: sha256File("src/content/vocabulary/generated/nce-1997.json"),
      editorialOverrides: sha256File("src/content/vocabulary/editorial-overrides.ts"),
      contentRatings: sha256File("src/content/vocabulary/content-ratings.json"),
      levelGenerator: sha256File("src/lib/level-generator.ts"),
      vocabularyLoader: sha256File("src/lib/vocabulary-loader.ts"),
      reviewMetadataKey: sha256File("src/lib/review-metadata-key.ts"),
      runtimeGenerator: sha256File("scripts/generate-runtime-content.cjs")
    };

    for (const [key, hash] of Object.entries(expectedInputHashes)) {
      assert.equal(manifest.inputHashes[key as keyof typeof manifest.inputHashes], hash, key);
    }
    assert.equal(manifest.editorialOverrideHash, expectedInputHashes.editorialOverrides);
    assert.equal(manifest.contentRatingsHash, expectedInputHashes.contentRatings);
    assert.equal(manifest.layoutHash, manifest.inputHashes.layouts);
    assert.equal(
      manifest.generatorHash,
      sha256(
        JSON.stringify({
          levelGenerator: expectedInputHashes.levelGenerator,
          vocabularyLoader: expectedInputHashes.vocabularyLoader,
          runtimeGenerator: expectedInputHashes.runtimeGenerator
        })
      )
    );
    const expectedContentHash = sha256(
      JSON.stringify({
        generatorVersion: manifest.generatorVersion,
        sourceHashes: manifest.sourceHashes,
        inputHashes: manifest.inputHashes,
        formatVersion: manifest.formatVersion
      })
    );
    assert.equal(manifest.contentHash, expectedContentHash);
    assert.equal(
      manifest.contentVersion,
      `nce-1997-${expectedContentHash.slice("sha256:".length, "sha256:".length + 16)}`
    );
    assert.equal(curriculumIndex.contentVersion, manifest.contentVersion);
    assert.equal(contentManifest.version, manifest.contentVersion);
    assert.equal(GAME_CONTENT_VERSION, manifest.contentVersion);

    const changedInputs = {
      ...manifest.inputHashes,
      editorialOverrides: `${manifest.inputHashes.editorialOverrides}-changed`
    };
    assert.notEqual(
      sha256(
        JSON.stringify({
          generatorVersion: manifest.generatorVersion,
          sourceHashes: manifest.sourceHashes,
          inputHashes: changedInputs,
          formatVersion: manifest.formatVersion
        })
      ),
      manifest.contentHash
    );
  });

  test("fails closed before registration when version or ratings drift", () => {
    resetRuntimeContentForTests();
    const first = curriculumIndex.levels[0];
    const runtime = JSON.parse(
      readFileSync(
        `public/content/runtime/levels/${toRuntimeFileKey(first.id)}.json`,
        "utf8"
      )
    ) as LevelRuntimeBundle;
    assert.equal(
      validateLevelRuntimeBundle(runtime, first.id, curriculumIndex.contentVersion),
      true
    );

    const stale = { ...runtime, contentVersion: "stale-content" };
    assert.equal(
      validateLevelRuntimeBundle(stale, first.id, curriculumIndex.contentVersion),
      false
    );
    const wordDrift = {
      ...runtime,
      vocabulary: runtime.vocabulary.map((word, index) =>
        index === 0 ? { ...word, rating: "13-plus" as const } : word
      )
    };
    assert.equal(
      validateLevelRuntimeBundle(wordDrift, first.id, curriculumIndex.contentVersion),
      false
    );
    const indexDrift = {
      ...runtime,
      rating: "13-plus" as const,
      vocabulary: runtime.vocabulary.map((word) => ({
        ...word,
        rating: "13-plus" as const
      }))
    };
    assert.equal(
      validateLevelRuntimeBundle(indexDrift, first.id, curriculumIndex.contentVersion),
      false
    );
    assert.equal(getRuntimeLevelById(first.id), undefined);
  });

  test("applies every centralized rating override at level severity", () => {
    const severity = { "all-ages": 0, "13-plus": 1, "parent-review": 2 } as const;
    for (const [expectedRating, wordIds] of Object.entries(ratingOverrides)) {
      for (const wordId of wordIds) {
        const payload = JSON.parse(
          readFileSync(
            `public/content/runtime/words/${toRuntimeFileKey(wordId)}.json`,
            "utf8"
          )
        ) as RuntimeVocabularyWordBundle;
        assert.equal(payload.contentVersion, curriculumIndex.contentVersion);
        const word = payload.word;
        assert.equal(word.id, wordId);
        assert.equal(word.rating, expectedRating, wordId);
        const levelSummary = curriculumIndex.levels.find((candidate) => {
          const runtime = JSON.parse(
            readFileSync(
              `public/content/runtime/levels/${toRuntimeFileKey(candidate.id)}.json`,
              "utf8"
            )
          ) as LevelRuntimeBundle;
          return runtime.vocabulary.some((entry) => entry.id === wordId);
        });
        assert.ok(levelSummary, wordId);
        assert.ok(
          severity[levelSummary.rating as keyof typeof severity] >=
            severity[expectedRating as keyof typeof severity],
          `${wordId}: ${levelSummary.rating}`
        );
      }
    }
  });
});
