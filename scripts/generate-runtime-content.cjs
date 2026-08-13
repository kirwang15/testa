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
const compiledEditorialOverrides = require(resolve(
  ROOT,
  ".content-dist/src/content/vocabulary/editorial-overrides.js"
));
const { createReviewWordKey } = require(resolve(
  ROOT,
  ".content-dist/src/lib/review-metadata-key.js"
));

const RUNTIME_FORMAT_VERSION = 3;
const RUNTIME_GENERATOR_VERSION = "runtime-content-v3-multi-curriculum";

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256File(relativePath) {
  return sha256(readFileSync(resolve(ROOT, relativePath)));
}

function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

const baseContentDocument = JSON.parse(
  readFileSync(
    resolve(ROOT, "src/content/vocabulary/generated/nce-1997.json"),
    "utf8"
  )
);

const ratingOverrides = require(resolve(
  ROOT,
  "src/content/vocabulary/content-ratings.json"
));
const PARENT_REVIEW_IDS = new Set(ratingOverrides["parent-review"]);
const THIRTEEN_PLUS_IDS = new Set(ratingOverrides["13-plus"]);

function toRuntimeFileKey(id) {
  return id.replace(/[^A-Za-z0-9._-]/g, (character) =>
    `_${character.codePointAt(0).toString(16)}_`
  );
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value)}\n`, "utf8");
}

function ratingForWords(words) {
  if (words.some((word) => PARENT_REVIEW_IDS.has(word.id))) {
    return "parent-review";
  }
  return words.some((word) => THIRTEEN_PLUS_IDS.has(word.id))
    ? "13-plus"
    : "all-ages";
}

function ratingForWordId(wordId) {
  if (PARENT_REVIEW_IDS.has(wordId)) return "parent-review";
  return THIRTEEN_PLUS_IDS.has(wordId) ? "13-plus" : "all-ages";
}

const runtimeRoot = resolve(ROOT, "public/content/runtime");
const levelRoot = resolve(runtimeRoot, "levels");
const wordRoot = resolve(runtimeRoot, "words");
const assessmentRoot = resolve(ROOT, "public/content/assessment");
rmSync(runtimeRoot, { recursive: true, force: true });
rmSync(assessmentRoot, { recursive: true, force: true });
mkdirSync(levelRoot, { recursive: true });
mkdirSync(wordRoot, { recursive: true });
mkdirSync(assessmentRoot, { recursive: true });

const primaryBooks = compiledLoader.getAllBooks();
const primaryUnits = compiledLoader.getAllUnits();
const generatedLegacyLevels = compiledLoader.getLegacyResolvedLevels({ mode: "learning" });
const mobileCatalogPath = "word_trail_flutter/assets/content/catalog.json";
const mobileCatalog = JSON.parse(readFileSync(resolve(ROOT, mobileCatalogPath), "utf8"));
const mobileBundles = mobileCatalog.levels.map((entry) => {
  const bundle = JSON.parse(readFileSync(resolve(ROOT, "word_trail_flutter", entry.assetPath), "utf8"));
  if (
    bundle.contentVersion !== mobileCatalog.contentVersion ||
    bundle.level?.id !== entry.id ||
    bundle.level?.curriculumId !== entry.curriculumId ||
    bundle.level?.trackId !== entry.trackId
  ) {
    throw new Error(`Mobile level bundle is inconsistent: ${entry.id}`);
  }
  return bundle;
});
const primaryLevels = mobileBundles.map((bundle) => bundle.level);
const mobileWordsById = new Map();
for (const bundle of mobileBundles) {
  for (const word of bundle.vocabulary) {
    const existing = mobileWordsById.get(word.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(word)) {
      throw new Error(`Mobile vocabulary drifted across levels: ${word.id}`);
    }
    mobileWordsById.set(word.id, word);
  }
}
const legacyWords = compiledLoader.getLegacyRegistryWords().map((word) => ({
  ...word,
  rating: ratingForWordId(word.id)
}));
const runtimeWords = [...mobileWordsById.values(), ...legacyWords];
const wordById = new Map(runtimeWords.map((word) => [word.id, word]));
const unknownRatingIds = [...PARENT_REVIEW_IDS, ...THIRTEEN_PLUS_IDS].filter(
  (wordId) => !wordById.has(wordId)
);
if (unknownRatingIds.length > 0) {
  throw new Error(`Unknown content rating ids: ${unknownRatingIds.join(", ")}`);
}

const structuralLevels = [...primaryLevels, ...generatedLegacyLevels].map(
  (level) => ({
    id: level.id,
    bookId: level.bookId,
    unitId: level.unitId,
    letters: level.letters,
    grid: level.grid,
    targetWords: level.targetWords.map((word) => ({
      id: word.id,
      vocabularyWordId: word.vocabularyWordId,
      word: word.word,
      start: word.start,
      direction: word.direction
    }))
  })
);
const layoutHash = sha256Json(structuralLevels);
const inputHashes = {
  baseContent: sha256File("src/content/vocabulary/generated/nce-1997.json"),
  editorialOverrides: sha256File("src/content/vocabulary/editorial-overrides.ts"),
  contentRatings: sha256File("src/content/vocabulary/content-ratings.json"),
  levelGenerator: sha256File("src/lib/level-generator.ts"),
  vocabularyLoader: sha256File("src/lib/vocabulary-loader.ts"),
  reviewMetadataKey: sha256File("src/lib/review-metadata-key.ts"),
  runtimeGenerator: sha256File("scripts/generate-runtime-content.cjs"),
  mobileCatalog: sha256File(mobileCatalogPath),
  assessmentBank: sha256File(
    "word_trail_flutter/assets/content/assessment/bank-v1.json"
  ),
  layouts: layoutHash,
  runtimeContent: sha256Json({
    words: runtimeWords,
    levels: structuralLevels
  })
};
const generatorVersion = [
  baseContentDocument.manifest.generatorVersion,
  compiledEditorialOverrides.EDITORIAL_OVERRIDE_VERSION,
  RUNTIME_GENERATOR_VERSION
].join("+");
const sourceHashes = Array.from(
  new Set([
    ...(baseContentDocument.manifest.sourceHashes ?? []),
    ...Object.values(inputHashes)
  ])
);
const contentHash = sha256Json({
  generatorVersion,
  sourceHashes,
  inputHashes,
  formatVersion: RUNTIME_FORMAT_VERSION
});
const contentVersion = `nce-1997-${contentHash.slice("sha256:".length, "sha256:".length + 16)}`;
const contentIdentityManifest = {
  version: contentVersion,
  contentVersion,
  generatedAt: baseContentDocument.manifest.generatedAt,
  generatorVersion,
  sourceHashes,
  formatVersion: RUNTIME_FORMAT_VERSION,
  editorialOverrideHash: inputHashes.editorialOverrides,
  contentRatingsHash: inputHashes.contentRatings,
  layoutHash,
  generatorHash: sha256Json({
    levelGenerator: inputHashes.levelGenerator,
    vocabularyLoader: inputHashes.vocabularyLoader,
    runtimeGenerator: inputHashes.runtimeGenerator
  }),
  contentHash,
  inputHashes
};

function bindLayoutRevision(level) {
  return {
    ...level,
    layoutRevision: compiledLevelGenerator.createLayoutRevision({
      levelId: level.id,
      wordIds: level.targetWords.map(
        (word) => word.vocabularyWordId ?? word.id
      ),
      normalizedSpellings: level.targetWords.map((word) => word.word),
      grid: level.grid,
      placements: level.targetWords.map((word, index) => ({
        index,
        start: word.start,
        direction: word.direction
      })),
      manifestVersion: contentVersion
    })
  };
}

const legacyLevels = generatedLegacyLevels.map(bindLayoutRevision);

for (const sourceBundle of mobileBundles) {
  const level = sourceBundle.level;
  const vocabulary = sourceBundle.vocabulary;
  const bundle = {
    contentVersion,
    level,
    vocabulary,
    releaseStatus: sourceBundle.releaseStatus,
    rating: sourceBundle.rating
  };
  writeJson(resolve(levelRoot, `${toRuntimeFileKey(level.id)}.json`), bundle);
}

for (const level of legacyLevels) {
  const vocabulary = level.targetWords
    .map((target) =>
      target.vocabularyWordId ? wordById.get(target.vocabularyWordId) : undefined
    )
    .filter(Boolean);
  writeJson(resolve(levelRoot, `${toRuntimeFileKey(level.id)}.json`), {
    contentVersion,
    level,
    vocabulary,
    releaseStatus: "automated-beta",
    rating: ratingForWords(vocabulary)
  });
}

for (const word of runtimeWords) {
  writeJson(resolve(wordRoot, `${toRuntimeFileKey(word.id)}.json`), {
    contentVersion,
    word
  });
}

const reviewMetadataEntries = Object.fromEntries(
  runtimeWords.map((word) => [
    createReviewWordKey(word.id),
    [
      Number(word.bookId.match(/(?:nce-1997-b|legacy:nce-)([1-4])/)?.[1] ?? 1),
      word.rating
    ]
  ])
);
if (Object.keys(reviewMetadataEntries).length !== runtimeWords.length) {
  throw new Error("Review metadata fingerprint collision detected.");
}
writeJson(resolve(runtimeRoot, "review-metadata.json"), {
  contentVersion,
  entries: reviewMetadataEntries
});
writeFileSync(
  resolve(assessmentRoot, "bank-v1.json"),
  readFileSync(
    resolve(ROOT, "word_trail_flutter/assets/content/assessment/bank-v1.json")
  )
);

const unitById = new Map(primaryUnits.map((unit) => [unit.id, unit]));
const levelById = new Map(primaryLevels.map((level) => [level.id, level]));
const bundleByLevelId = new Map(mobileBundles.map((bundle) => [bundle.level.id, bundle]));
const index = {
  contentVersion,
  generatedAt: contentIdentityManifest.generatedAt,
  curricula: mobileCatalog.curricula.map((curriculum) => ({
    ...curriculum,
    levelCount: mobileCatalog.levels.filter(
      (level) => level.curriculumId === curriculum.id
    ).length
  })),
  tracks: mobileCatalog.tracks.map((track) => ({
    id: track.id,
    curriculumId: track.curriculumId,
    titleEn: track.titleEn,
    titleZh: track.titleZh,
    order: track.order
  })),
  books: primaryBooks.map((book) => ({
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    description: book.description,
    level: book.level,
    estimatedWordCount: book.estimatedWordCount ?? 0,
    colorTheme: book.colorTheme,
    contentKind: "curriculum",
    unitIds: [...book.unitIds]
  })),
  units: primaryUnits.map((unit) => {
    const unitLevels = primaryLevels.filter((level) => level.unitId === unit.id);
    return {
      id: unit.id,
      bookId: unit.bookId,
      title: unit.title,
      lessonRange: unit.lessonRange,
      difficulty: unit.difficulty,
      estimatedMinutes: unit.estimatedMinutes,
      wordCount: new Set(
        unitLevels.flatMap((level) =>
          level.targetWords.map((target) => target.vocabularyWordId ?? target.id)
        )
      ).size
    };
  }),
  levels: primaryLevels.map((level) => {
    const source = bundleByLevelId.get(level.id);
    return {
      id: level.id,
      ...(source.rating === "all-ages" ? {} : { rating: source.rating })
    };
  })
};

if (
  index.curricula.length !== 3 ||
  index.tracks.length !== 12 ||
  index.books.length !== 4 ||
  index.units.length !== 20 ||
  index.levels.length !== 800 ||
  index.levels.filter((level) => level.id.startsWith("nce-1997-")).length !== 400 ||
  index.levels.filter((level) => level.id.startsWith("ielts-nawl-v1-")).length !== 200 ||
  index.levels.filter((level) => level.id.startsWith("kaoyan-core-v1-")).length !== 200 ||
  new Set(index.levels.map((level) => level.id)).size !== index.levels.length ||
  index.levels.some((level) => !levelById.has(level.id))
) {
  throw new Error("Refusing to publish an incomplete curriculum runtime index.");
}

writeJson(
  resolve(ROOT, "src/content/vocabulary/generated/curriculum-index.json"),
  index
);
writeJson(
  resolve(ROOT, "src/content/vocabulary/generated/level-rating-codes.json"),
  primaryLevels.flatMap((level, index) => {
    const rating = bundleByLevelId.get(level.id).rating;
    return rating === "all-ages"
      ? []
      : [index, rating === "13-plus" ? 1 : 2];
  })
);
writeJson(
  resolve(ROOT, "src/content/vocabulary/generated/content-manifest.json"),
  contentIdentityManifest
);
writeJson(resolve(runtimeRoot, "manifest.json"), {
  contentVersion: index.contentVersion,
  generatedAt: index.generatedAt,
  levelCount: primaryLevels.length,
  legacyLevelCount: legacyLevels.length,
  wordCount: runtimeWords.length,
  formatVersion: RUNTIME_FORMAT_VERSION,
  generatorVersion,
  sourceHashes,
  editorialOverrideHash: inputHashes.editorialOverrides,
  contentRatingsHash: inputHashes.contentRatings,
  layoutHash,
  generatorHash: contentIdentityManifest.generatorHash,
  contentHash,
  inputHashes
});

console.log(
  `Generated ${primaryLevels.length} primary level bundles, ${legacyLevels.length} legacy bundles, and ${runtimeWords.length} word records.`
);
