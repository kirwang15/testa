#!/usr/bin/env node

/*
 * Generates the complete offline Flutter curriculum from the canonical NCE
 * source plus the checked-in NAWL authoring document. It is invoked after the
 * TypeScript content compiler so both Web and Flutter derive from one build.
 */

const { createHash } = require("node:crypto");
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const ROOT = resolve(__dirname, "..");
const compiledLoader = require(resolve(
  ROOT,
  ".content-dist/src/lib/vocabulary-loader.js"
));
const compiledLevelGenerator = require(resolve(
  ROOT,
  ".content-dist/src/lib/level-generator.js"
));
const compatibility = require(resolve(
  ROOT,
  "src/content/vocabulary/generated/nce-core-compatibility.json"
));
const ieltsDocument = require(resolve(
  process.env.IELTS_CONTENT_PATH ??
    resolve(ROOT, "src/content/vocabulary/generated/ielts-nawl-v1.json")
));
const ratingOverrides = require(resolve(
  ROOT,
  "src/content/vocabulary/content-ratings.json"
));

const FLUTTER_CONTENT_ROOT = resolve(
  ROOT,
  "word_trail_flutter/assets/content"
);
const FLUTTER_LEVEL_ROOT = resolve(FLUTTER_CONTENT_ROOT, "levels");
const PUBLIC_CONTENT_ROOT = resolve(ROOT, "public/content/runtime");
const SCHEMA_VERSION = 1;
const GENERATOR_VERSION = "mobile-curriculum-v1";
const NCE_CURRICULUM_ID = "nce-1997";
const IELTS_CURRICULUM_ID = "ielts-nawl-v1";
const PARENT_REVIEW_IDS = new Set(ratingOverrides["parent-review"]);
const THIRTEEN_PLUS_IDS = new Set(ratingOverrides["13-plus"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value, pretty = false) {
  return `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`;
}

function writeJson(path, value, pretty = false) {
  writeFileSync(path, stableJson(value, pretty), "utf8");
}

function ratingForWordId(wordId) {
  if (PARENT_REVIEW_IDS.has(wordId)) return "parent-review";
  return THIRTEEN_PLUS_IDS.has(wordId) ? "13-plus" : "all-ages";
}

function ratingForWords(words) {
  if (words.some((word) => word.rating === "parent-review")) {
    return "parent-review";
  }
  return words.some((word) => word.rating === "13-plus")
    ? "13-plus"
    : "all-ages";
}

function getBookNumber(bookId) {
  const match = /^nce-1997-b([1-4])$/.exec(bookId);
  if (!match) throw new Error(`Invalid NCE book id: ${bookId}`);
  return Number(match[1]);
}

function levelNumberFromId(levelId) {
  const match = /-level-(\d{3})$/.exec(levelId);
  if (!match) throw new Error(`Invalid level id: ${levelId}`);
  return Number(match[1]);
}

function normalizeCoreStructure(level) {
  return {
    id: level.id,
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
    difficulty: level.difficulty
  };
}

function assertCoreCompatibility(coreLevels) {
  const expectedById = new Map(
    compatibility.levels.map((entry) => [entry.id, entry])
  );
  if (coreLevels.length !== 200 || expectedById.size !== 200) {
    throw new Error("NCE core compatibility snapshot must contain 200 levels.");
  }
  for (const level of coreLevels) {
    const expected = expectedById.get(level.id);
    if (!expected) throw new Error(`Missing compatibility record for ${level.id}`);
    const actualJson = JSON.stringify(normalizeCoreStructure(level));
    const expectedJson = JSON.stringify({
      id: expected.id,
      orderedWordIds: expected.orderedWordIds,
      letters: expected.letters,
      grid: expected.grid,
      placements: expected.placements,
      rewardCoins: expected.rewardCoins,
      perfectBonusCoins: expected.perfectBonusCoins,
      difficulty: expected.difficulty
    });
    if (actualJson !== expectedJson) {
      throw new Error(`NCE core level changed incompatibly: ${level.id}`);
    }
  }
  return expectedById;
}

function toLayout(level) {
  return {
    grid: level.grid,
    placements: level.targetWords.map((word, index) => ({
      index,
      word: word.word,
      start: word.start,
      direction: word.direction
    }))
  };
}

function assertValidLevel(level) {
  const analysis = compiledLevelGenerator.analyzeCrosswordLayout(toLayout(level));
  if (
    !analysis.connected ||
    !analysis.hasAcrossAndDown ||
    analysis.conflicts.length > 0 ||
    analysis.unexpectedRuns.length > 0 ||
    !analysis.withinGrid ||
    level.grid.rows > 11 ||
    level.grid.cols > 11 ||
    level.targetWords.some((word) => {
      const cells = word.word.split("").map((_, offset) => ({
        row: word.start.row + (word.direction === "down" ? offset : 0),
        col: word.start.col + (word.direction === "across" ? offset : 0)
      }));
      return !cells.some((cell) =>
        level.targetWords.some((other) => {
          if (other.id === word.id) return false;
          return other.word.split("").some((_, offset) =>
            other.start.row + (other.direction === "down" ? offset : 0) === cell.row &&
            other.start.col + (other.direction === "across" ? offset : 0) === cell.col
          );
        })
      );
    })
  ) {
    throw new Error(`Level ${level.id} failed the formal crossword gate.`);
  }
}

function answerForms(spelling) {
  const forms = new Set([spelling]);
  if (/[^aeiou]y$/i.test(spelling)) {
    forms.add(`${spelling.slice(0, -1)}ies`);
    forms.add(`${spelling.slice(0, -1)}ied`);
  } else {
    forms.add(/(?:s|x|z|ch|sh|o)$/i.test(spelling) ? `${spelling}es` : `${spelling}s`);
    forms.add(/e$/i.test(spelling) ? `${spelling}d` : `${spelling}ed`);
  }
  forms.add(
    /e$/i.test(spelling) && !/ee$/i.test(spelling)
      ? `${spelling.slice(0, -1)}ing`
      : `${spelling}ing`
  );
  return [...forms];
}

function groupHasClueLeak(words) {
  return words.some((clueOwner) =>
    words.some((answer) =>
      answerForms(answer.word).some((form) => {
        const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`, "i").test(
          clueOwner.englishMeaning ?? ""
        );
      })
    )
  );
}

function tryGenerate(words, id, options = {}) {
  if (groupHasClueLeak(words)) return undefined;
  try {
    const level = compiledLevelGenerator.generateLevelFromWords(words, {
      id,
      title: options.title ?? id,
      bookId: options.bookId,
      unitId: options.unitId,
      mode: "learning",
      requireConnected: true,
      maxGridSize: 11,
      manifestVersion: options.contentVersion
    });
    if (!level) return undefined;
    assertValidLevel(level);
    return level;
  } catch {
    return undefined;
  }
}

function remixNceGroups(coreBookLevels, wordById, contentVersion) {
  const coreGroups = coreBookLevels.map((level) =>
    level.targetWords.map((target) => {
      const word = wordById.get(target.vocabularyWordId ?? target.id);
      if (!word) throw new Error(`Missing NCE word ${target.id}`);
      return word;
    })
  );
  const replacements = new Map();
  const adjacency = coreGroups.map(() => []);
  for (let leftGroupIndex = 0; leftGroupIndex < coreGroups.length; leftGroupIndex += 1) {
    for (
      let rightGroupIndex = leftGroupIndex + 1;
      rightGroupIndex < coreGroups.length;
      rightGroupIndex += 1
    ) {
      const left = coreGroups[leftGroupIndex];
      const right = coreGroups[rightGroupIndex];
      let replacement;
      for (
        let leftWordIndex = 0;
        leftWordIndex < left.length && !replacement;
        leftWordIndex += 1
      ) {
        for (
          let rightWordIndex = 0;
          rightWordIndex < right.length && !replacement;
          rightWordIndex += 1
        ) {
          const nextLeft = [...left];
          const nextRight = [...right];
          [nextLeft[leftWordIndex], nextRight[rightWordIndex]] = [
            nextRight[rightWordIndex],
            nextLeft[leftWordIndex]
          ];
          const leftLevel = tryGenerate(
            nextLeft,
            `probe-${leftGroupIndex}-${rightGroupIndex}-left`,
            { contentVersion }
          );
          const rightLevel = tryGenerate(
            nextRight,
            `probe-${leftGroupIndex}-${rightGroupIndex}-right`,
            { contentVersion }
          );
          if (leftLevel && rightLevel) replacement = [nextLeft, nextRight];
        }
      }
      if (!replacement) continue;
      const key = `${leftGroupIndex}:${rightGroupIndex}`;
      replacements.set(key, replacement);
      adjacency[leftGroupIndex].push(rightGroupIndex);
      adjacency[rightGroupIndex].push(leftGroupIndex);
    }
  }

  const assigned = new Array(coreGroups.length);
  function findPerfectMatching(remaining) {
    if (remaining.length === 0) return true;
    const remainingSet = new Set(remaining);
    const pivot = [...remaining].sort(
      (left, right) =>
        adjacency[left].filter((candidate) => remainingSet.has(candidate)).length -
          adjacency[right].filter((candidate) => remainingSet.has(candidate)).length ||
        left - right
    )[0];
    const partners = adjacency[pivot]
      .filter((candidate) => remainingSet.has(candidate))
      .sort((left, right) => left - right);
    for (const partner of partners) {
      const leftIndex = Math.min(pivot, partner);
      const rightIndex = Math.max(pivot, partner);
      const replacement = replacements.get(`${leftIndex}:${rightIndex}`);
      if (!replacement) continue;
      assigned[leftIndex] = replacement[0];
      assigned[rightIndex] = replacement[1];
      const nextRemaining = remaining.filter(
        (index) => index !== pivot && index !== partner
      );
      if (findPerfectMatching(nextRemaining)) return true;
      assigned[leftIndex] = undefined;
      assigned[rightIndex] = undefined;
    }
    return false;
  }

  if (!findPerfectMatching(coreGroups.map((_, index) => index))) {
    const isolated = adjacency
      .map((neighbors, index) => ({ index, degree: neighbors.length }))
      .filter((entry) => entry.degree === 0)
      .map((entry) => entry.index + 1);
    throw new Error(
      `Unable to find a global NCE remix matching; isolated groups: ${isolated.join(",") || "none"}`
    );
  }
  return assigned;
}

function createNceReinforcementLevels(coreLevels, nceWords, contentVersion) {
  const wordById = new Map(nceWords.map((word) => [word.id, word]));
  const coreSignatures = new Set(
    coreLevels.map((level) =>
      level.targetWords
        .map((word) => word.vocabularyWordId ?? word.id)
        .sort()
        .join("|")
    )
  );
  const result = [];
  for (let book = 1; book <= 4; book += 1) {
    const bookId = `nce-1997-b${book}`;
    const bookCore = coreLevels.filter((level) => level.bookId === bookId);
    const groups = remixNceGroups(bookCore, wordById, contentVersion);
    const usedWordIds = [];
    groups.forEach((words, index) => {
      const levelNumber = index + 51;
      const unitNumber = Math.floor(index / 10) + 1;
      const id = `${bookId}-level-${String(levelNumber).padStart(3, "0")}`;
      const signature = words.map((word) => word.id).sort().join("|");
      if (coreSignatures.has(signature)) {
        throw new Error(`Reinforcement group duplicates a core group: ${id}`);
      }
      const level = tryGenerate(words, id, {
        title: `Book ${book} · Reinforcement ${String(levelNumber).padStart(3, "0")}`,
        bookId,
        unitId: `${bookId}-u${unitNumber}`,
        contentVersion
      });
      if (!level) throw new Error(`Unable to generate ${id}`);
      usedWordIds.push(...words.map((word) => word.id));
      result.push({
        ...level,
        curriculumId: NCE_CURRICULUM_ID,
        trackId: bookId,
        levelNumber
      });
    });
    const expectedIds = nceWords
      .filter((word) => word.bookId === bookId)
      .map((word) => word.id)
      .sort();
    if (
      usedWordIds.length !== 200 ||
      JSON.stringify([...usedWordIds].sort()) !== JSON.stringify(expectedIds)
    ) {
      throw new Error(`NCE reinforcement coverage failed for ${bookId}`);
    }
  }
  return result;
}

function sharedLetterCount(left, right) {
  const letters = new Set(left.word.toUpperCase());
  return new Set(right.word.toUpperCase()).size === 0
    ? 0
    : [...new Set(right.word.toUpperCase())].filter((letter) => letters.has(letter)).length;
}

function createPrng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function shuffle(values, seed) {
  const result = [...values];
  const random = createPrng(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function partitionIeltsWords(words, contentVersion) {
  const wordIndexById = new Map(words.map((word, index) => [word.id, index]));
  const sharedMatrix = words.map((left, leftIndex) =>
    words.map((right, rightIndex) =>
      leftIndex === rightIndex ? 0 : sharedLetterCount(left, right)
    )
  );
  const letterDegrees = sharedMatrix.map((row) =>
    row.reduce((count, value) => count + (value > 0 ? 1 : 0), 0)
  );
  const edgeByKey = new Map();
  const edgeKeysByWord = words.map(() => new Set());
  const tripleValidity = new Map();

  function addEdge(indexes) {
    const sortedIndexes = [...indexes].sort((left, right) => left - right);
    const key = sortedIndexes.join(":");
    if (edgeByKey.has(key)) return;
    edgeByKey.set(key, sortedIndexes);
    sortedIndexes.forEach((index) => edgeKeysByWord[index].add(key));
  }

  function isValidTriple(indexes) {
    const sortedIndexes = [...indexes].sort((left, right) => left - right);
    const key = sortedIndexes.join(":");
    if (!tripleValidity.has(key)) {
      const group = sortedIndexes.map((index) => words[index]);
      tripleValidity.set(
        key,
        Boolean(
          tryGenerate(group, `ielts-global-probe-${key}`, { contentVersion })
        )
      );
    }
    return tripleValidity.get(key);
  }

  function ensureHyperedges(targetDegree) {
    const order = words
      .map((_, index) => index)
      .sort(
        (left, right) =>
          edgeKeysByWord[left].size - edgeKeysByWord[right].size ||
          letterDegrees[left] - letterDegrees[right] ||
          words[left].frequencyRank - words[right].frequencyRank
      );
    for (const pivotIndex of order) {
      if (edgeKeysByWord[pivotIndex].size >= targetDegree) continue;
      const firstCandidates = words
        .map((_, index) => index)
        .filter(
          (index) =>
            index !== pivotIndex && sharedMatrix[pivotIndex][index] > 0
        )
        .sort(
          (left, right) =>
            edgeKeysByWord[left].size - edgeKeysByWord[right].size ||
            letterDegrees[left] - letterDegrees[right] ||
            sharedMatrix[pivotIndex][right] - sharedMatrix[pivotIndex][left] ||
            words[left].frequencyRank - words[right].frequencyRank
        );
      for (const firstIndex of firstCandidates) {
        const secondCandidates = words
          .map((_, index) => index)
          .filter(
            (index) =>
              index !== pivotIndex &&
              index !== firstIndex &&
              (sharedMatrix[pivotIndex][index] > 0 ||
                sharedMatrix[firstIndex][index] > 0)
          )
          .sort(
            (left, right) =>
              edgeKeysByWord[left].size - edgeKeysByWord[right].size ||
              letterDegrees[left] - letterDegrees[right] ||
              sharedMatrix[pivotIndex][right] + sharedMatrix[firstIndex][right] -
                (sharedMatrix[pivotIndex][left] + sharedMatrix[firstIndex][left]) ||
              words[left].frequencyRank - words[right].frequencyRank
          );
        for (const secondIndex of secondCandidates) {
          const indexes = [pivotIndex, firstIndex, secondIndex];
          const key = [...indexes].sort((left, right) => left - right).join(":");
          if (edgeByKey.has(key) || !isValidTriple(indexes)) continue;
          addEdge(indexes);
          if (edgeKeysByWord[pivotIndex].size >= targetDegree) break;
        }
        if (edgeKeysByWord[pivotIndex].size >= targetDegree) break;
      }
    }
  }

  function solveExactCover(nodeBudget) {
    const remaining = new Set(words.map((_, index) => index));
    const solution = [];
    const failedStates = new Set();
    let visitedNodes = 0;
    let smallestRemaining = remaining.size;
    let zeroDegreeWords = [];

    function activeEdges(index) {
      return [...edgeKeysByWord[index]]
        .map((key) => edgeByKey.get(key))
        .filter((edge) => edge.every((wordIndex) => remaining.has(wordIndex)));
    }

    function search() {
      visitedNodes += 1;
      smallestRemaining = Math.min(smallestRemaining, remaining.size);
      if (visitedNodes > nodeBudget) return false;
      if (remaining.size === 0) return true;
      const stateKey =
        remaining.size <= 45
          ? [...remaining].sort((left, right) => left - right).join(":")
          : undefined;
      if (stateKey && failedStates.has(stateKey)) return false;

      let pivotIndex;
      let pivotEdges;
      for (const index of remaining) {
        const candidates = activeEdges(index);
        if (!pivotEdges || candidates.length < pivotEdges.length) {
          pivotIndex = index;
          pivotEdges = candidates;
        }
        if (candidates.length === 0) break;
      }
      if (!pivotEdges || pivotEdges.length === 0) {
        zeroDegreeWords = [...remaining]
          .filter((index) => activeEdges(index).length === 0)
          .map((index) => words[index].word);
        if (stateKey) failedStates.add(stateKey);
        return false;
      }

      pivotEdges.sort((left, right) => {
        const leftPressure = left
          .filter((index) => index !== pivotIndex)
          .reduce((sum, index) => sum + activeEdges(index).length, 0);
        const rightPressure = right
          .filter((index) => index !== pivotIndex)
          .reduce((sum, index) => sum + activeEdges(index).length, 0);
        return leftPressure - rightPressure || left.join(":").localeCompare(right.join(":"));
      });
      for (const edge of pivotEdges) {
        edge.forEach((index) => remaining.delete(index));
        solution.push(edge);
        if (search()) return true;
        solution.pop();
        edge.forEach((index) => remaining.add(index));
      }
      if (stateKey) failedStates.add(stateKey);
      return false;
    }

    const solved = search();
    return { solved, solution, visitedNodes, smallestRemaining, zeroDegreeWords };
  }

  let latestResult;
  for (const targetDegree of [48, 96, 192]) {
    ensureHyperedges(targetDegree);
    const zeroHyperedgeWords = words.filter(
      (_, index) => edgeKeysByWord[index].size === 0
    );
    if (zeroHyperedgeWords.length > 0) {
      throw new Error(
        `IELTS zero-hyperedge words: ${zeroHyperedgeWords
          .map((word) => `${word.frequencyRank}:${word.word}`)
          .join(",")}`
      );
    }
    latestResult = solveExactCover(250_000);
    process.stdout.write(
      `IELTS hypergraph degree>=${targetDegree}: ${edgeByKey.size} triples, ` +
        `${latestResult.solution.length}/200 groups, ${600 - latestResult.solution.length * 3} words left, ` +
        `${latestResult.visitedNodes} backtrack nodes, smallest remainder ${latestResult.smallestRemaining}.\n`
    );
    if (latestResult.solved && latestResult.solution.length === 200) {
      return latestResult.solution.map((edge) => edge.map((index) => words[index]));
    }
  }
  throw new Error(
    `Unable to cover 600 IELTS words; zero-active words: ${latestResult?.zeroDegreeWords.join(",") || "none"}`
  );
}

function createIeltsLevels(authoredWords, contentVersion) {
  if (
    authoredWords.length !== 600 ||
    new Set(authoredWords.map((word) => word.word.toLowerCase())).size !== 600
  ) {
    throw new Error("IELTS authoring document must contain 600 unique spellings.");
  }
  const result = [];
  const groups = partitionIeltsWords(authoredWords, contentVersion).sort(
    (left, right) =>
      left.reduce((sum, word) => sum + word.frequencyRank, 0) / left.length -
        right.reduce((sum, word) => sum + word.frequencyRank, 0) / right.length ||
      Math.max(...left.map((word) => word.frequencyRank)) -
        Math.max(...right.map((word) => word.frequencyRank))
  );
  const stageStats = [];
  for (let stage = 1; stage <= 4; stage += 1) {
    const trackId = `${IELTS_CURRICULUM_ID}-s${stage}`;
    const stageGroups = groups.slice((stage - 1) * 50, stage * 50);
    const stageRanks = stageGroups.flatMap((group) =>
      group.map((word) => word.frequencyRank)
    );
    stageStats.push({
      stage,
      mean: stageRanks.reduce((sum, rank) => sum + rank, 0) / stageRanks.length,
      min: Math.min(...stageRanks),
      max: Math.max(...stageRanks)
    });
    stageGroups.forEach((group, stageIndex) => {
      const levelNumber = (stage - 1) * 50 + stageIndex + 1;
      const id = `${IELTS_CURRICULUM_ID}-level-${String(levelNumber).padStart(3, "0")}`;
      const words = group.map((word) => ({
        ...word,
        bookId: trackId,
        unitId: trackId
      }));
      const level = tryGenerate(words, id, {
        title: `IELTS Academic · ${String(levelNumber).padStart(3, "0")}`,
        bookId: trackId,
        unitId: trackId,
        contentVersion
      });
      if (!level) throw new Error(`Unable to generate ${id}`);
      result.push({
        ...level,
        curriculumId: IELTS_CURRICULUM_ID,
        trackId,
        levelNumber,
        rewardCoins: 20,
        perfectBonusCoins: 5,
        difficulty: levelNumber <= 100 ? "easy" : "medium"
      });
    });
  }
  if (
    stageStats.some(
      (entry, index) => index > 0 && entry.mean <= stageStats[index - 1].mean
    )
  ) {
    throw new Error("IELTS stage average ranks must increase monotonically.");
  }
  process.stdout.write(
    `IELTS exact cover 200/200; stage ranks ${stageStats
      .map(
        (entry) =>
          `s${entry.stage}=mean${entry.mean.toFixed(1)}[${entry.min}-${entry.max}]`
      )
      .join(" ")}.\n`
  );
  return result;
}

function createCatalog(levelBundles, contentVersion) {
  const nceTrackIds = [1, 2, 3, 4].map((book) => `nce-1997-b${book}`);
  const ieltsTrackIds = [1, 2, 3, 4].map(
    (stage) => `${IELTS_CURRICULUM_ID}-s${stage}`
  );
  const tracks = [
    ...nceTrackIds.map((id, index) => ({
      id,
      curriculumId: NCE_CURRICULUM_ID,
      titleEn: `Book ${index + 1}`,
      titleZh: `第 ${index + 1} 册`,
      order: index + 1,
      levelIds: levelBundles
        .filter((bundle) => bundle.level.trackId === id)
        .sort((left, right) => left.level.levelNumber - right.level.levelNumber)
        .map((bundle) => bundle.level.id)
    })),
    ...ieltsTrackIds.map((id, index) => ({
      id,
      curriculumId: IELTS_CURRICULUM_ID,
      titleEn: `Stage ${index + 1}`,
      titleZh: `第 ${index + 1} 阶段`,
      order: index + 1,
      levelIds: levelBundles
        .filter((bundle) => bundle.level.trackId === id)
        .sort((left, right) => left.level.levelNumber - right.level.levelNumber)
        .map((bundle) => bundle.level.id)
    }))
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    contentVersion,
    curricula: [
      {
        id: NCE_CURRICULUM_ID,
        titleEn: "New Concept English",
        titleZh: "新概念英语",
        trackIds: nceTrackIds
      },
      {
        id: IELTS_CURRICULUM_ID,
        titleEn: "IELTS Preparation Vocabulary",
        titleZh: "IELTS 备考词汇",
        trackIds: ieltsTrackIds
      }
    ],
    tracks,
    levels: levelBundles.map((bundle) => ({
      id: bundle.level.id,
      curriculumId: bundle.level.curriculumId,
      trackId: bundle.level.trackId,
      order:
        bundle.level.curriculumId === IELTS_CURRICULUM_ID
          ? ((bundle.level.levelNumber - 1) % 50) + 1
          : bundle.level.levelNumber,
      levelNumber: bundle.level.levelNumber,
      rating: bundle.rating,
      assetPath: `assets/content/levels/${bundle.level.id}.json`
    }))
  };
}

function main() {
  const nceWords = compiledLoader.getAllWords().map((word) => ({
    ...word,
    rating: ratingForWordId(word.id)
  }));
  const nceWordById = new Map(nceWords.map((word) => [word.id, word]));
  const generatedCoreLevels = compiledLoader.getResolvedLevels({ mode: "learning" });
  const compatibilityById = assertCoreCompatibility(generatedCoreLevels);
  const contentSeed = stableJson({
    nceCompatibility: compatibility,
    resolvedNceWords: nceWords,
    contentRatings: ratingOverrides,
    ieltsManifest: ieltsDocument.manifest,
    ieltsWords: ieltsDocument.words,
    generatorVersion: GENERATOR_VERSION,
    generatorSha256: sha256(readFileSync(__filename))
  });
  const contentVersion = `word-trail-${sha256(contentSeed).slice(0, 16)}`;

  const coreLevels = generatedCoreLevels.map((level) => ({
    ...level,
    curriculumId: NCE_CURRICULUM_ID,
    trackId: level.bookId,
    levelNumber: levelNumberFromId(level.id),
    layoutRevision: compatibilityById.get(level.id).layoutRevision
  }));
  coreLevels.forEach(assertValidLevel);
  const reinforcementLevels = createNceReinforcementLevels(
    coreLevels,
    nceWords,
    contentVersion
  );
  const ieltsLevels = createIeltsLevels(ieltsDocument.words, contentVersion);
  const allLevels = [...coreLevels, ...reinforcementLevels, ...ieltsLevels];
  const ieltsTrackByWordId = new Map(
    ieltsLevels.flatMap((level) =>
      level.targetWords.map((word) => [
        word.vocabularyWordId ?? word.id,
        level.trackId
      ])
    )
  );
  if (ieltsTrackByWordId.size !== 600) {
    throw new Error("Every IELTS word must map to exactly one generated stage.");
  }
  const ieltsWordById = new Map(
    ieltsDocument.words.map((word) => {
      const trackId = ieltsTrackByWordId.get(word.id);
      if (!trackId) throw new Error(`Missing IELTS stage for ${word.id}`);
      return [
        word.id,
        {
          ...word,
          bookId: trackId,
          unitId: trackId,
          rating: "all-ages"
        }
      ];
    })
  );

  const bundles = allLevels.map((level) => {
    const vocabulary = level.targetWords.map((target) => {
      const wordId = target.vocabularyWordId ?? target.id;
      const word = nceWordById.get(wordId) ?? ieltsWordById.get(wordId);
      if (!word) throw new Error(`Missing vocabulary for ${level.id}/${wordId}`);
      return word;
    });
    return {
      contentVersion,
      level,
      vocabulary,
      releaseStatus: "automated-beta",
      rating: ratingForWords(vocabulary)
    };
  });
  const nceBundles = bundles.filter(
    (bundle) => bundle.level.curriculumId === NCE_CURRICULUM_ID
  );
  const ieltsBundles = bundles.filter(
    (bundle) => bundle.level.curriculumId === IELTS_CURRICULUM_ID
  );
  if (
    bundles.length !== 600 ||
    nceBundles.length !== 400 ||
    ieltsBundles.length !== 200 ||
    new Set(bundles.map((bundle) => bundle.level.id)).size !== 600 ||
    [1, 2, 3, 4].some(
      (book) =>
        nceBundles.filter((bundle) => bundle.level.trackId === `nce-1997-b${book}`)
          .length !== 100
    ) ||
    [1, 2, 3, 4].some(
      (stage) =>
        ieltsBundles.filter(
          (bundle) => bundle.level.trackId === `${IELTS_CURRICULUM_ID}-s${stage}`
        ).length !== 50
    )
  ) {
    throw new Error("Refusing to publish an incomplete 600-level mobile catalog.");
  }

  rmSync(FLUTTER_LEVEL_ROOT, { recursive: true, force: true });
  mkdirSync(FLUTTER_LEVEL_ROOT, { recursive: true });
  for (const bundle of bundles) {
    writeJson(resolve(FLUTTER_LEVEL_ROOT, `${bundle.level.id}.json`), bundle);
  }
  const catalog = createCatalog(bundles, contentVersion);
  writeJson(resolve(FLUTTER_CONTENT_ROOT, "catalog.json"), catalog, true);
  mkdirSync(PUBLIC_CONTENT_ROOT, { recursive: true });
  writeJson(resolve(PUBLIC_CONTENT_ROOT, "catalog.json"), catalog, true);

  process.stdout.write(
    `Generated mobile catalog ${contentVersion}: 400 NCE + 200 IELTS = 600 level bundles.\n`
  );
}

main();
