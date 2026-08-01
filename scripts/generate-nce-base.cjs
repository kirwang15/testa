#!/usr/bin/env node

/*
 * Offline NCE curriculum assembler.
 *
 * It accepts caller-provided HTML snapshots plus an authored seed curriculum,
 * verifies every selected word's Book/Lesson mapping against both snapshots,
 * and emits the static curriculum, structured manifest, and provenance report.
 * It performs no network requests and has no hard-coded temporary paths.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CHINESE_MEANING_OVERRIDES = {
  cup: "杯子",
  less: "(little的比较级)较少的，更小的",
  windscreen: "(汽车的)挡风玻璃",
};
const PART_OF_SPEECH_OVERRIDES = {
  last: "adjective",
  woollen: "adjective",
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(`Expected --key value, got ${key ?? "(end)"}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function required(args, key) {
  const value = args[key];
  if (!value) throw new Error(`Missing required --${key}`);
  return path.resolve(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readSnapshot(filePath) {
  const bytes = fs.readFileSync(filePath);
  return { text: bytes.toString("utf8"), hash: sha256(bytes) };
}

function normalizeWord(value) {
  return value.trim().toLowerCase();
}

function addMapping(index, book, lesson, word) {
  const key = `${book}:${lesson}:${normalizeWord(word)}`;
  index.add(key);
}

function parseNcegoSnapshot(html, book) {
  const index = new Set();
  let lesson;
  const tokenPattern = /Lesson\s+(\d+)(?:&amp;\d+)?[^<]*<\/a>|data-word="([^"]+)"/g;
  for (const match of html.matchAll(tokenPattern)) {
    if (match[1]) {
      lesson = Number(match[1]);
    } else if (match[2] && lesson) {
      addMapping(index, book, lesson, match[2]);
    }
  }
  return index;
}

function parseSecondarySnapshot(html) {
  const index = new Set();
  const entryPattern = /"l":"(\d+)-(\d+)","w":"([^"]+)"/g;
  for (const match of html.matchAll(entryPattern)) {
    addMapping(index, Number(match[1]), Number(match[2]), match[3]);
  }
  return index;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const seedPath = required(args, "seed");
  const outPath = required(args, "out");
  const reportPath = required(args, "report");
  const secondaryPath = required(args, "secondary");
  const snapshotDate = args["snapshot-date"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate ?? "")) {
    throw new Error("--snapshot-date must use YYYY-MM-DD");
  }

  const bookSnapshots = [1, 2, 3, 4].map((book) => ({
    book,
    path: required(args, `book${book}`),
  }));
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const loadedBooks = bookSnapshots.map((snapshot) => ({
    ...snapshot,
    ...readSnapshot(snapshot.path),
  }));
  const secondary = readSnapshot(secondaryPath);
  const ncegoIndexes = new Map(
    loadedBooks.map((snapshot) => [
      snapshot.book,
      parseNcegoSnapshot(snapshot.text, snapshot.book),
    ]),
  );
  const secondaryIndex = parseSecondarySnapshot(secondary.text);
  for (const book of seed.books) {
    const sourceBooks = new Set(
      book.units.flatMap((unit) =>
        unit.words.flatMap((word) => (word.source ? [word.source.book] : [])),
      ),
    );
    if (sourceBooks.size !== 1) {
      throw new Error(`${book.id} must contain words from exactly one source book`);
    }
    const sourceBook = [...sourceBooks][0];
    book.id = `nce-1997-b${sourceBook}`;
  }
  const words = seed.books.flatMap((book) =>
    book.units.flatMap((unit) => unit.words),
  );
  for (const word of words) {
    if (CHINESE_MEANING_OVERRIDES[word.word]) {
      word.chineseMeaning = CHINESE_MEANING_OVERRIDES[word.word];
    }
    if (PART_OF_SPEECH_OVERRIDES[word.word]) {
      word.partOfSpeech = PART_OF_SPEECH_OVERRIDES[word.word];
    }
  }
  const reportEntries = [];

  for (const word of words) {
    const source = word.source;
    if (!source) throw new Error(`${word.id} has no source metadata`);
    const key = `${source.book}:${source.lesson}:${normalizeWord(word.word)}`;
    if (!ncegoIndexes.get(source.book)?.has(key)) {
      throw new Error(`${word.id} missing from ncego Book ${source.book} Lesson ${source.lesson}`);
    }
    if (!secondaryIndex.has(key)) {
      throw new Error(`${word.id} missing from secondary index Book ${source.book} Lesson ${source.lesson}`);
    }
    const expectedProvenance =
      `ncego-b${source.book}-l${source.lesson}|ncecom-b${source.book}-l${source.lesson}`;
    if (source.provenanceId !== expectedProvenance) {
      throw new Error(`${word.id} has inconsistent provenanceId`);
    }
    reportEntries.push({
      wordId: word.id,
      word: word.word,
      book: source.book,
      lesson: source.lesson,
      provenanceId: source.provenanceId,
      sourceIds: [
        `ncego-book-${source.book}`,
        "newconceptenglish-word-index",
      ],
    });
  }

  reportEntries.sort((left, right) => left.wordId.localeCompare(right.wordId));
  const report = {
    version: "nce-1997-provenance-v1",
    generatedAt: `${snapshotDate}T00:00:00.000Z`,
    entries: reportEntries,
  };
  const reportJson = stableJson(report);
  const relativeReportPath = path.relative(ROOT, reportPath);
  const sources = [
    ...loadedBooks.map((snapshot) => ({
      id: `ncego-book-${snapshot.book}`,
      name: `NCEGO Book ${snapshot.book} vocabulary index`,
      url: `https://www.ncego.com/books/words/nce${snapshot.book}`,
      snapshotDate,
      sha256: `sha256:${snapshot.hash}`,
      licenseStatus: "unknown-reference-only",
      version: `snapshot-${snapshotDate}`,
    })),
    {
      id: "newconceptenglish-word-index",
      name: "NewConceptEnglish.com 1997 vocabulary index",
      url: "https://newconceptenglish.com/index.php?id=words",
      snapshotDate,
      sha256: `sha256:${secondary.hash}`,
      licenseStatus: "unknown-reference-only",
      version: `snapshot-${snapshotDate}`,
    },
  ];

  seed.manifest = {
    ...seed.manifest,
    // This identifies the immutable source snapshot only. The deployable
    // contentVersion is content-addressed by generate-runtime-content.cjs.
    version: "nce-1997-source-base-v1",
    sourceHashes: sources.map((source) => source.sha256),
    sources,
    provenanceIds: [...new Set(reportEntries.map((entry) => entry.provenanceId))].sort(),
    mappingReport: {
      path: relativeReportPath,
      sha256: `sha256:${sha256(reportJson)}`,
      entries: reportEntries.length,
    },
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(reportPath, reportJson);
  fs.writeFileSync(outPath, stableJson(seed));
  process.stdout.write(
    `Verified and wrote ${words.length} words, ${seed.manifest.provenanceIds.length} provenance ids.\n`,
  );
}

main();
