import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import compatibility from "../src/content/vocabulary/generated/nce-core-compatibility.json";

type CatalogLevel = {
  id: string;
  curriculumId: string;
  trackId: string;
  order: number;
  levelNumber: number;
  rating: string;
  assetPath: string;
};

type Bundle = {
  contentVersion: string;
  level: {
    id: string;
    curriculumId: string;
    trackId: string;
    levelNumber: number;
    bookId: string;
    unitId: string;
    letters: string[];
    targetWords: Array<{
      id: string;
      vocabularyWordId?: string;
      word: string;
      start: { row: number; col: number };
      direction: "across" | "down";
      source: Record<string, unknown>;
    }>;
    grid: { rows: number; cols: number };
    rewardCoins: number;
    perfectBonusCoins?: number;
    difficulty?: string;
    layoutRevision: string;
  };
  vocabulary: Array<{
    id: string;
    word: string;
    englishMeaning: string;
    chineseMeaning: string;
    phonetic: string;
    partOfSpeech: string;
    examples: string[];
    source: Record<string, unknown>;
  }>;
  releaseStatus: string;
  rating: string;
};

const catalog = JSON.parse(
  readFileSync("word_trail_flutter/assets/content/catalog.json", "utf8")
) as {
  schemaVersion: number;
  contentVersion: string;
  curricula: Array<{ id: string; trackIds: string[] }>;
  tracks: Array<{
    id: string;
    curriculumId: string;
    order: number;
    levelIds: string[];
  }>;
  levels: CatalogLevel[];
};
const ieltsAuthoring = JSON.parse(
  readFileSync(
    "src/content/vocabulary/generated/ielts-nawl-v1.json",
    "utf8"
  )
) as {
  manifest: {
    wordCount: number;
    editorialOverrides: { count: number; words: string[]; sha256: string };
    safety: {
      policyVersion: string;
      excludedCount: number;
      excludedWords: Array<{ word: string; rank: number; reasons: string[] }>;
      replacementCount: number;
      replacementWords: string[];
    };
    crosswordEligibility: {
      policyVersion: string;
      minimumLetters: number;
      excludedCount: number;
      excludedWords: Array<{ word: string; rank: number }>;
      replacementCount: number;
      replacementWords: string[];
    };
  };
};

const unsafeWordPatterns = [
  /^adult(?:hood)?$/i,
  /^alcohol/i,
  /^assault/i,
  /^bleed/i,
  /^bodil/i,
  /^bullet/i,
  /^corpse/i,
  /^cruel/i,
  /^(?:dead|death|die|died|dying)$/i,
  /^drug/i,
  /^drunk/i,
  /^gun/i,
  /^kill/i,
  /^missile/i,
  /^murder/i,
  /^(?:naked|nudity)$/i,
  /^punish/i,
  /^(?:rape|raped|raping|rapist)$/i,
  /^sex/i,
  /^slav/i,
  /^sperm/i,
  /^suicid/i,
  /^terror/i,
  /^tortur/i,
  /^urine/i,
  /^weapon/i,
  /^whisk(?:y|ey)/i
];
const unsafeDefinitionPatterns = [
  /\b(?:adult|alcohol|assault|bullet|corpse|drug|drunk|gun|missile|weapon|whisk(?:y|ey))s?\b/i,
  /\b(?:dead|death|die|died|dying|kill|murder|rape|torture)(?:s|d|ing|er)?\b/i,
  /\b(?:naked|nudity|sex|sexual|sexuality|sperm)\b/i,
  /\b(?:slave|slavery|slaver|enslave)(?:s|d|ing)?\b/i,
  /\b(?:suicide|suicidal|terror|terrorism|terrorist)\b/i
];

function loadBundle(entry: CatalogLevel) {
  return JSON.parse(
    readFileSync(`word_trail_flutter/${entry.assetPath}`, "utf8")
  ) as Bundle;
}

function cells(word: Bundle["level"]["targetWords"][number]) {
  return word.word.split("").map((letter, offset) => ({
    key: `${word.start.row + (word.direction === "down" ? offset : 0)}:${
      word.start.col + (word.direction === "across" ? offset : 0)
    }`,
    letter
  }));
}

function assertFormalBoard(bundle: Bundle) {
  const { level } = bundle;
  assert.equal(bundle.contentVersion, catalog.contentVersion, level.id);
  assert.equal(level.id, catalog.levels.find((entry) => entry.id === level.id)?.id);
  assert.ok(level.grid.rows <= 11 && level.grid.cols <= 11, level.id);
  assert.ok(level.targetWords.some((word) => word.direction === "across"), level.id);
  assert.ok(level.targetWords.some((word) => word.direction === "down"), level.id);
  const occupied = new Map<
    string,
    { letter: string; wordIds: Set<string>; directions: Set<string> }
  >();
  for (const word of level.targetWords) {
    for (const cell of cells(word)) {
      const existing = occupied.get(cell.key);
      if (!existing) {
        occupied.set(cell.key, {
          letter: cell.letter,
          wordIds: new Set([word.id]),
          directions: new Set([word.direction])
        });
        continue;
      }
      assert.equal(existing.letter, cell.letter, `${level.id}:${cell.key}`);
      assert.equal(existing.directions.has(word.direction), false, level.id);
      existing.wordIds.add(word.id);
      existing.directions.add(word.direction);
    }
  }
  for (const word of level.targetWords) {
    assert.ok(
      cells(word).some((cell) => (occupied.get(cell.key)?.wordIds.size ?? 0) > 1),
      `${level.id}:${word.id} is isolated`
    );
  }
}

describe("mobile multi-curriculum content", () => {
  test("ships one 600-level catalog with the required course topology", () => {
    assert.equal(catalog.schemaVersion, 1);
    assert.equal(catalog.curricula.length, 2);
    assert.equal(catalog.tracks.length, 8);
    assert.equal(catalog.levels.length, 600);
    assert.equal(new Set(catalog.levels.map((entry) => entry.id)).size, 600);
    assert.equal(
      catalog.levels.filter((entry) => entry.curriculumId === "nce-1997").length,
      400
    );
    assert.equal(
      catalog.levels.filter((entry) => entry.curriculumId === "ielts-nawl-v1")
        .length,
      200
    );
    for (const track of catalog.tracks) {
      assert.equal(
        track.levelIds.length,
        track.curriculumId === "nce-1997" ? 100 : 50,
        track.id
      );
    }
  });

  test("freezes the auditable all-ages NAWL safety policy", () => {
    assert.equal(ieltsAuthoring.manifest.wordCount, 600);
    assert.equal(ieltsAuthoring.manifest.safety.policyVersion, "all-ages-v1");
    assert.equal(ieltsAuthoring.manifest.safety.excludedCount, 25);
    assert.equal(ieltsAuthoring.manifest.safety.excludedWords.length, 25);
    assert.equal(ieltsAuthoring.manifest.safety.replacementCount, 12);
    assert.equal(ieltsAuthoring.manifest.safety.replacementWords.length, 12);
    assert.ok(
      ieltsAuthoring.manifest.safety.excludedWords.some(
        (entry) => entry.word === "sexuality"
      )
    );
    assert.ok(
      ieltsAuthoring.manifest.safety.excludedWords.some(
        (entry) => entry.word === "slavery"
      )
    );
    assert.equal(
      ieltsAuthoring.manifest.crosswordEligibility.policyVersion,
      "crossword-min-3-v1"
    );
    assert.equal(ieltsAuthoring.manifest.crosswordEligibility.minimumLetters, 3);
    assert.deepEqual(
      ieltsAuthoring.manifest.crosswordEligibility.excludedWords.map(
        (entry) => entry.word
      ),
      ["ex", "pi"]
    );
    assert.equal(ieltsAuthoring.manifest.crosswordEligibility.replacementCount, 2);
    assert.equal(ieltsAuthoring.manifest.editorialOverrides.count, 2);
    assert.deepEqual([...ieltsAuthoring.manifest.editorialOverrides.words].sort(), [
      "multiply",
      "stack"
    ]);
    assert.match(
      ieltsAuthoring.manifest.editorialOverrides.sha256,
      /^sha256:[0-9a-f]{64}$/
    );
  });

  test("preserves every NCE core layout and builds a distinct full-coverage reinforcement", () => {
    const compatibilityById = new Map(
      compatibility.levels.map((entry) => [entry.id, entry])
    );
    for (const entry of catalog.levels.filter(
      (item) => item.curriculumId === "nce-1997" && item.levelNumber <= 50
    )) {
      const level = loadBundle(entry).level;
      const expected = compatibilityById.get(level.id);
      assert.ok(expected, level.id);
      assert.deepEqual(
        {
          orderedWordIds: level.targetWords.map(
            (word) => word.vocabularyWordId ?? word.id
          ),
          letters: level.letters,
          grid: level.grid,
          placements: level.targetWords.map((word) => ({
            id: word.vocabularyWordId ?? word.id,
            start: word.start,
            direction: word.direction
          })),
          rewardCoins: level.rewardCoins,
          perfectBonusCoins: level.perfectBonusCoins,
          difficulty: level.difficulty,
          layoutRevision: level.layoutRevision
        },
        {
          orderedWordIds: expected?.orderedWordIds,
          letters: expected?.letters,
          grid: expected?.grid,
          placements: expected?.placements,
          rewardCoins: expected?.rewardCoins,
          perfectBonusCoins: expected?.perfectBonusCoins,
          difficulty: expected?.difficulty,
          layoutRevision: expected?.layoutRevision
        },
        level.id
      );
    }

    for (let book = 1; book <= 4; book += 1) {
      const trackId = `nce-1997-b${book}`;
      const entries = catalog.levels
        .filter((entry) => entry.trackId === trackId)
        .sort((left, right) => left.levelNumber - right.levelNumber);
      const core = entries.slice(0, 50).map(loadBundle);
      const reinforcement = entries.slice(50).map(loadBundle);
      assert.deepEqual(
        reinforcement.map((bundle) => bundle.level.targetWords.length),
        [...Array(15).fill(3), ...Array(20).fill(4), ...Array(15).fill(5)]
      );
      const coreSpellings = core.flatMap((bundle) =>
        bundle.level.targetWords.map((word) => word.word)
      );
      const reinforcementSpellings = reinforcement.flatMap((bundle) =>
        bundle.level.targetWords.map((word) => word.word)
      );
      assert.equal(coreSpellings.length, 200);
      assert.equal(new Set(coreSpellings).size, 200);
      assert.deepEqual([...reinforcementSpellings].sort(), [...coreSpellings].sort());
      const coreGroups = new Set(
        core.map((bundle) =>
          bundle.level.targetWords.map((word) => word.word).sort().join("|")
        )
      );
      assert.equal(
        reinforcement.some((bundle) =>
          coreGroups.has(
            bundle.level.targetWords.map((word) => word.word).sort().join("|")
          )
        ),
        false,
        trackId
      );
      const coreLayoutRevisions = new Set(
        core.map((bundle) => bundle.level.layoutRevision)
      );
      const reinforcementLayoutRevisions = reinforcement.map(
        (bundle) => bundle.level.layoutRevision
      );
      assert.equal(new Set(reinforcementLayoutRevisions).size, 50, trackId);
      assert.equal(
        reinforcementLayoutRevisions.some((revision) =>
          coreLayoutRevisions.has(revision)
        ),
        false,
        trackId
      );
    }
  });

  test("ships 600 unique fully-authored NAWL words and validates every board", () => {
    const ieltsSpellings = new Set<string>();
    const stageRanks = new Map<string, number[]>();
    for (const entry of catalog.levels) {
      const bundle = loadBundle(entry);
      assertFormalBoard(bundle);
      if (entry.curriculumId !== "ielts-nawl-v1") continue;
      assert.equal(bundle.level.targetWords.length, 3, entry.id);
      for (const word of bundle.vocabulary) {
        assert.equal(ieltsSpellings.has(word.word.toLowerCase()), false, word.word);
        ieltsSpellings.add(word.word.toLowerCase());
        for (const pattern of unsafeWordPatterns) {
          assert.equal(pattern.test(word.word), false, `${word.id}:${pattern.source}`);
        }
        const userFacingEnglish = [word.englishMeaning, ...word.examples].join(" ");
        for (const pattern of unsafeDefinitionPatterns) {
          assert.equal(
            pattern.test(userFacingEnglish),
            false,
            `${word.id}:${pattern.source}`
          );
        }
        assert.match(word.id, /^ielts-nawl-v1-[a-z]+$/);
        assert.ok(word.englishMeaning.trim().length > 0, word.id);
        assert.match(word.chineseMeaning, /[\u3400-\u9fff]/u, word.id);
        assert.ok(word.phonetic.trim().length > 0, word.id);
        assert.ok(word.partOfSpeech.trim().length > 0, word.id);
        assert.equal(word.examples.length, 1, word.id);
        assert.equal(word.source.type, "ielts", word.id);
        assert.equal(word.source.listId, "NAWL-1.2", word.id);
        assert.ok(Number(word.source.rank) > 0, word.id);
        const ranks = stageRanks.get(entry.trackId) ?? [];
        ranks.push(Number(word.source.rank));
        stageRanks.set(entry.trackId, ranks);
        assert.match(String(word.source.provenanceId), /^nawl-1\.2:[0-9a-f]{64}$/);
      }
    }
    assert.equal(ieltsSpellings.size, 600);
    const stageMeans = [1, 2, 3, 4].map((stage) => {
      const ranks = stageRanks.get(`ielts-nawl-v1-s${stage}`) ?? [];
      assert.equal(ranks.length, 150, `IELTS stage ${stage}`);
      return ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    });
    assert.ok(
      stageMeans.every(
        (mean, index) => index === 0 || mean > stageMeans[index - 1]
      ),
      stageMeans.join(",")
    );
  });
});
