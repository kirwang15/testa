#!/usr/bin/env node

/*
 * Builds the checked-in, offline authoring document for the independent
 * Kaoyan starter course. NGSL/NAWL are used only for headword selection and
 * rank provenance; definitions, glosses and examples come from Word Trail's
 * existing locally authored/open-licensed content.
 */

const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const ROOT = resolve(__dirname, "..");
const NGSL_PATH = resolve(
  ROOT,
  "src/content/vocabulary/sources/ngsl-1.2-basic-stats.csv"
);
const NCE_PATH = resolve(
  ROOT,
  "src/content/vocabulary/generated/nce-1997.json"
);
const IELTS_PATH = resolve(
  ROOT,
  "src/content/vocabulary/generated/ielts-nawl-v1.json"
);
const RATINGS_PATH = resolve(
  ROOT,
  "src/content/vocabulary/content-ratings.json"
);
const OUTPUT_PATH = resolve(
  ROOT,
  "src/content/vocabulary/generated/kaoyan-core-v1.json"
);
const WORDFREQ_PATH = resolve(
  ROOT,
  "src/content/vocabulary/sources/kaoyan-wordfreq-3.1.1.csv"
);

const NGSL_URL =
  "https://static1.squarespace.com/static/64336926d7c6bb38965fdf3b/t/644e0be4ad7bae3d45b9e62a/1682836452194/NGSL_1.2_stats.csv";
const NGSL_PAGE_URL =
  "https://www.newgeneralservicelist.com/new-general-service-list";
const UPSTREAM_NGSL_SHA256 =
  "2098bab8955a120a9766c6282a51d7d578c6cb0a7d946600d2ffb73ba25a0b44";
const BUNDLED_NGSL_SHA256 =
  "af00443ff394cbd18546612ce935498f3ccc8465bb2d4a47f576d7da51e7a3d6";
const WORDFREQ_VERSION = "3.1.1";
const WORDFREQ_SNAPSHOT_SHA256 =
  "793643c75edca398e298f0bc95fcb4ea9fe91b1a98effa4161b6983b78cf3bc5";
const UNSAFE_WORD =
  /^(?:adult(?:hood)?|alcohol.*|assault.*|bleed.*|bullet.*|corpse.*|cruel.*|dead|death|drug.*|drunk.*|gun.*|kill.*|missile.*|murder.*|naked|nudity|punish.*|rape.*|sex.*|slave.*|sperm.*|suicid.*|terror.*|tortur.*|urine.*|weapon.*|whisk(?:y|ey).*)$/i;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseNgsl(source) {
  const rows = source.trim().split(/\r?\n/);
  if (rows.shift() !== "Lemma,SFI Rank,SFI,Adjusted Frequency per Million (U)") {
    throw new Error("Unexpected NGSL 1.2 header.");
  }
  return rows.map((row) => {
    const [word, rank, sfi, frequency] = row.split(",");
    return {
      word: word.toLowerCase(),
      rank: Number(rank),
      sfi: Number(sfi),
      frequencyPerMillion: Number(frequency)
    };
  });
}

function parseWordfreq(source) {
  const rows = source.trim().split(/\r?\n/);
  if (rows.shift() !== "word,zipfFrequency") {
    throw new Error("Unexpected wordfreq snapshot header.");
  }
  return new Map(
    rows.map((row) => {
      const [word, zipfFrequency] = row.split(",");
      return [word, Number(zipfFrequency)];
    })
  );
}

function cloneForCourse(word, source, courseRank, stage) {
  const spelling = word.word.toLowerCase();
  return {
    id: `kaoyan-core-v1-${spelling}`,
    word: spelling,
    displayText: spelling,
    englishMeaning: word.englishMeaning,
    chineseMeaning: word.chineseMeaning,
    phonetic: word.phonetic,
    partOfSpeech: word.partOfSpeech,
    cefrLevel: word.cefrLevel,
    frequencyRank: courseRank,
    examples: [...word.examples],
    tags: ["kaoyan-preparation", "starter", source.listId.toLowerCase()],
    learningConcept: `kaoyan-core-v1-r${courseRank}-${spelling}`,
    reviewStatus: "automated",
    source: {
      type: "kaoyan",
      listId: source.listId,
      rank: source.rank,
      provenanceId: source.provenanceId,
      wordfreqVersion: WORDFREQ_VERSION,
      zipfFrequency: source.zipfFrequency
    },
    rating: "all-ages",
    stage
  };
}

function main() {
  const ngslSource = readFileSync(NGSL_PATH);
  const actualNgslSha256 = sha256(ngslSource);
  if (actualNgslSha256 !== BUNDLED_NGSL_SHA256) {
    throw new Error(
      `Bundled NGSL snapshot hash mismatch: expected ${BUNDLED_NGSL_SHA256}, got ${actualNgslSha256}`
    );
  }
  const ngslRows = parseNgsl(ngslSource.toString("utf8"));
  if (ngslRows.length !== 2809) {
    throw new Error(`Expected 2809 ranked NGSL entries, got ${ngslRows.length}.`);
  }
  const ngslByWord = new Map(ngslRows.map((entry) => [entry.word, entry]));
  const wordfreqSource = readFileSync(WORDFREQ_PATH);
  const actualWordfreqSha256 = sha256(wordfreqSource);
  if (actualWordfreqSha256 !== WORDFREQ_SNAPSHOT_SHA256) {
    throw new Error(
      `Bundled wordfreq snapshot hash mismatch: expected ${WORDFREQ_SNAPSHOT_SHA256}, got ${actualWordfreqSha256}`
    );
  }
  const wordfreqByWord = parseWordfreq(wordfreqSource.toString("utf8"));
  const nceDocument = readJson(NCE_PATH);
  const ieltsDocument = readJson(IELTS_PATH);
  const ratings = readJson(RATINGS_PATH);
  const restrictedIds = new Set([
    ...ratings["parent-review"],
    ...ratings["13-plus"]
  ]);
  const nceWords = nceDocument.books.flatMap((book) =>
    book.units.flatMap((unit) => unit.words)
  );
  const eligibleNgslBySpelling = new Map();
  for (const word of nceWords) {
    const spelling = word.word.toLowerCase();
    if (
      !/^[a-z]{3,10}$/.test(spelling) ||
      UNSAFE_WORD.test(spelling) ||
      restrictedIds.has(word.id) ||
      !ngslByWord.has(spelling)
    ) {
      continue;
    }
    eligibleNgslBySpelling.set(spelling, word);
  }
  const selectedNgsl = [...eligibleNgslBySpelling.values()]
    .sort(
      (left, right) =>
        ngslByWord.get(left.word.toLowerCase()).rank -
          ngslByWord.get(right.word.toLowerCase()).rank ||
        left.word.localeCompare(right.word)
    )
    .slice(-300);
  if (selectedNgsl.length !== 300) {
    throw new Error(`Expected 300 eligible NGSL words, got ${selectedNgsl.length}.`);
  }
  const selectedNawl = [...ieltsDocument.words]
    .filter((word) => /^[a-z]{3,10}$/.test(word.word) && word.rating === "all-ages")
    .sort(
      (left, right) =>
        left.frequencyRank - right.frequencyRank || left.word.localeCompare(right.word)
    )
    .slice(0, 300);
  if (selectedNawl.length !== 300) {
    throw new Error(`Expected 300 eligible NAWL words, got ${selectedNawl.length}.`);
  }

  const selectedSpellings = new Set(
    [...selectedNgsl, ...selectedNawl].map((word) => word.word.toLowerCase())
  );
  if (
    selectedSpellings.size !== 600 ||
    wordfreqByWord.size !== 600 ||
    [...selectedSpellings].some((word) => !wordfreqByWord.has(word)) ||
    [...wordfreqByWord].some(
      ([word, value]) => !selectedSpellings.has(word) || !Number.isFinite(value)
    )
  ) {
    throw new Error("wordfreq snapshot must exactly cover the 600 selected words.");
  }
  selectedNgsl.sort(
    (left, right) =>
      wordfreqByWord.get(right.word.toLowerCase()) -
        wordfreqByWord.get(left.word.toLowerCase()) ||
      ngslByWord.get(left.word.toLowerCase()).rank -
        ngslByWord.get(right.word.toLowerCase()).rank ||
      left.word.localeCompare(right.word)
  );
  selectedNawl.sort(
    (left, right) =>
      wordfreqByWord.get(right.word.toLowerCase()) -
        wordfreqByWord.get(left.word.toLowerCase()) ||
      left.frequencyRank - right.frequencyRank ||
      left.word.localeCompare(right.word)
  );

  const words = [
    ...selectedNgsl.map((word, index) => {
      const ngsl = ngslByWord.get(word.word.toLowerCase());
      return cloneForCourse(
        word,
        {
          listId: "NGSL-1.2",
          rank: ngsl.rank,
          zipfFrequency: wordfreqByWord.get(word.word.toLowerCase()),
          provenanceId: `ngsl-1.2:${BUNDLED_NGSL_SHA256}`
        },
        index + 1,
        index < 150 ? 1 : 2
      );
    }),
    ...selectedNawl.map((word, index) =>
      cloneForCourse(
        word,
        {
          listId: "NAWL-1.2",
          rank: word.source.rank,
          zipfFrequency: wordfreqByWord.get(word.word.toLowerCase()),
          provenanceId: word.source.provenanceId
        },
        index + 301,
        index < 150 ? 3 : 4
      )
    )
  ];
  if (
    words.length !== 600 ||
    new Set(words.map((word) => word.word)).size !== 600 ||
    words.some(
      (word) =>
        !word.englishMeaning ||
        !word.chineseMeaning ||
        !word.phonetic ||
        !word.partOfSpeech ||
        !word.examples[0]
    )
  ) {
    throw new Error("Kaoyan authoring document failed its 600-word field gate.");
  }
  const stageCounts = Object.fromEntries(
    [1, 2, 3, 4].map((stage) => [
      stage,
      words.filter((word) => word.stage === stage).length
    ])
  );
  if (Object.values(stageCounts).some((count) => count !== 150)) {
    throw new Error(`Invalid stage counts: ${JSON.stringify(stageCounts)}`);
  }

  const document = {
    manifest: {
      version: "kaoyan-core-v1-source-base-v1",
      generatedAt: "2026-08-12T00:00:00.000Z",
      generatorVersion: "kaoyan-core-authoring-v1",
      releaseStatus: "automated-beta",
      license: "CC-BY-SA-4.0",
      courseStatus: "independent-starter-reference",
      wordCount: 600,
      sourceCounts: { "NGSL-1.2": 300, "NAWL-1.2": 300 },
      stageCounts,
      sources: [
        {
          listId: "NGSL-1.2",
          title: "New General Service List 1.2",
          author: "Browne, C., Culligan, B., & Phillips, J.",
          pageUrl: NGSL_PAGE_URL,
          snapshotUrl: NGSL_URL,
          upstreamSnapshotSha256: `sha256:${UPSTREAM_NGSL_SHA256}`,
          bundledSnapshotSha256: `sha256:${BUNDLED_NGSL_SHA256}`,
          lineEndingNormalization: "CRLF-to-LF",
          license: "CC-BY-SA-4.0"
        },
        {
          ...ieltsDocument.manifest.source,
          license: "CC-BY-SA-4.0"
        },
        {
          listId: "wordfreq-3.1.1",
          title: "wordfreq English Zipf frequencies",
          author: "Robyn Speer and upstream corpus contributors",
          pageUrl: "https://github.com/rspeer/wordfreq",
          bundledSnapshotSha256: `sha256:${WORDFREQ_SNAPSHOT_SHA256}`,
          license: "CC-BY-SA-4.0",
          usage: "Auxiliary ordering only"
        }
      ],
      localAuthoring: {
        policyVersion: "kaoyan-local-adaptation-v1",
        nceInputSha256: `sha256:${sha256(readFileSync(NCE_PATH))}`,
        ieltsInputSha256: `sha256:${sha256(readFileSync(IELTS_PATH))}`,
        note:
          "Definitions, Chinese glosses, phonetics and examples are reused from Word Trail local/open-licensed authoring, not copied from exam materials."
      }
    },
    words
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Authored ${OUTPUT_PATH}: 300 NGSL + 300 NAWL = 600 unique words; stages 150/150/150/150.\n`
  );
}

main();
