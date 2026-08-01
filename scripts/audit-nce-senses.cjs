#!/usr/bin/env node

/* Deterministic audit for human-confirmed sense/POS risks. */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_PATH = path.join(
  ROOT,
  "src/content/vocabulary/generated/nce-1997.json",
);
const OUTPUT_PATH = path.join(
  ROOT,
  "artifacts/content-audit/nce-sense-candidates.json",
);

const EXPECTATIONS = {
  swing: {
    partOfSpeech: "verb",
    clue: /turn|direction/i,
    chinese: /转向/,
    example: /\bswing\b.*\b(?:left|right|toward|direction)\b/i,
  },
  cherish: {
    partOfSpeech: "verb",
    clue: /hope|wish/i,
    chinese: /期望|渴望/,
    example: /\bcherish\b.*\bhope\b/i,
  },
  blur: {
    partOfSpeech: "verb",
    clue: /focus|unclear/i,
    chinese: /模糊/,
    example: /\bblur\b.*\bview\b/i,
  },
  zip: {
    partOfSpeech: "noun",
    clue: /fastener|teeth|slider/i,
    chinese: /拉链/,
    example: /\bzip\b.*\b(?:bag|coat)\b/i,
  },
  landlord: {
    partOfSpeech: "noun",
    clue: /pub|property/i,
    chinese: /店主/,
    example: /\blandlord\b.*\bpub\b/i,
  },
};

const content = JSON.parse(fs.readFileSync(CONTENT_PATH, "utf8"));
const words = content.books.flatMap((book) =>
  book.units.flatMap((unit) => unit.words),
);
const bySpelling = new Map(words.map((word) => [word.word, word]));

const candidates = Object.entries(EXPECTATIONS).map(([spelling, expected]) => {
  const word = bySpelling.get(spelling);
  const checks = {
    present: Boolean(word),
    partOfSpeech: word?.partOfSpeech === expected.partOfSpeech,
    clue: expected.clue.test(word?.englishMeaning ?? ""),
    chinese: expected.chinese.test(word?.chineseMeaning ?? ""),
    example: expected.example.test(word?.examples?.[0] ?? ""),
  };
  return {
    spelling,
    wordId: word?.id,
    status: Object.values(checks).every(Boolean) ? "resolved" : "unresolved",
    checks,
    current: word
      ? {
          partOfSpeech: word.partOfSpeech,
          englishMeaning: word.englishMeaning,
          chineseMeaning: word.chineseMeaning,
          example: word.examples?.[0],
        }
      : undefined,
  };
});

const report = {
  contentVersion: content.manifest.version,
  policyVersion: "human-confirmed-sense-audit-v1",
  candidates,
  unresolved: candidates.filter((candidate) => candidate.status === "unresolved")
    .length,
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `Sense audit: ${candidates.length} candidates, ${report.unresolved} unresolved.\n`,
);
if (report.unresolved > 0) process.exitCode = 1;
