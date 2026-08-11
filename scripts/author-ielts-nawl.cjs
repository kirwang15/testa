#!/usr/bin/env node

/*
 * Offline, resumable authoring helper for the IELTS-oriented NAWL course.
 *
 * The caller supplies snapshots downloaded from the NAWL project. The script
 * selects the highest-frequency 600 child-safe alphabetic entries, asks a
 * local Ollama model for Chinese glosses plus original clues/examples, applies
 * deterministic validation, and writes a checked-in authoring document.
 * Network access is deliberately outside this script.
 */

const { createHash } = require("node:crypto");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = resolve(__dirname, "..");
const DEFAULT_OUTPUT = resolve(
  ROOT,
  "src/content/vocabulary/generated/ielts-nawl-v1.json"
);
const DEFAULT_CHECKPOINT = "/private/tmp/ielts-nawl-authoring-checkpoint.json";
const MODEL = process.env.IELTS_AUTHOR_MODEL || "gemma4:e4b";
const MODEL_DIGEST =
  process.env.IELTS_AUTHOR_MODEL_DIGEST ||
  "sha256:4c27e0f5b5adf02ac956c7322bd2ee7636fe3f45a8512c9aba5385242cb6e09a";
const BATCH_SIZE = Number(process.env.IELTS_AUTHOR_BATCH_SIZE || 10);
const MAX_ATTEMPTS = Number(process.env.IELTS_AUTHOR_MAX_ATTEMPTS || 2);
const EDITORIAL_OVERRIDES = Object.freeze({
  multiply: Object.freeze({
    zh: "乘；成倍增加",
    clue: "To increase a number by repeated addition",
    example: "Bacteria multiply quickly in warm conditions."
  }),
  stack: Object.freeze({
    zh: "堆叠",
    clue: "To arrange things neatly one above another",
    example: "We stack the books neatly after class."
  })
});
const UNSAFE_WORD_PATTERNS = Object.freeze([
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
]);
const UNSAFE_DEFINITION_PATTERNS = Object.freeze([
  /\b(?:adult|alcohol|assault|bullet|corpse|drug|drunk|gun|missile|weapon|whisk(?:y|ey))s?\b/i,
  /\b(?:dead|death|die|died|dying|kill|murder|rape|torture)(?:s|d|ing|er)?\b/i,
  /\b(?:naked|nudity|sex|sexual|sexuality|sperm)\b/i,
  /\b(?:slave|slavery|slaver|enslave)(?:s|d|ing)?\b/i,
  /\b(?:suicide|suicidal|terror|terrorism|terrorist)\b/i
]);
const CHINESE_PATTERN = /[\u3400-\u9fff]/u;
const ANSI_PATTERN =
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

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

function requiredPath(args, key) {
  if (!args[key]) throw new Error(`Missing --${key}`);
  return resolve(args[key]);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function parseDictionary(html) {
  const rows = [];
  const tableRows = [...html.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi)];
  for (const tableRow of tableRows) {
    const cells = [...tableRow[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map(
      (match) => match[1]
    );
    if (cells.length < 5) continue;
    const rank = Number(decodeHtml(cells[0]));
    const word = decodeHtml(cells[1]).toLowerCase();
    const phonetic = decodeHtml(cells[2]);
    const partOfSpeech = decodeHtml(cells[3]);
    const sourceDefinition = decodeHtml(cells[4].split("</a>").pop() ?? "");
    if (
      Number.isInteger(rank) &&
      /^[a-z]+$/.test(word) &&
      phonetic &&
      partOfSpeech &&
      sourceDefinition
    ) {
      rows.push({ rank, word, phonetic, partOfSpeech, sourceDefinition });
    }
  }
  return rows;
}

function parseAlphabetized(text) {
  return new Set(
    text
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => /^[a-z]+$/.test(line))
  );
}

function unsafeReasons(entry) {
  const reasons = [];
  UNSAFE_WORD_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(entry.word)) reasons.push(`word-pattern-${index + 1}`);
  });
  UNSAFE_DEFINITION_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(entry.sourceDefinition)) {
      reasons.push(`definition-pattern-${index + 1}`);
    }
  });
  return reasons;
}

function answerPattern(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(?:s|es|ed|ing|ly)?\\b`, "i");
}

function validateAuthored(entry, authored) {
  if (!authored || typeof authored !== "object") return "missing object";
  const chineseMeaning = String(authored.zh ?? "").trim();
  const englishMeaning = String(authored.clue ?? "").trim().replace(/[.]+$/, "");
  const example = String(authored.example ?? "").trim();
  const clueWords = englishMeaning.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  const exampleWords = example.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
  if (!CHINESE_PATTERN.test(chineseMeaning)) return "zh is not Simplified Chinese";
  if (clueWords.length < 3 || clueWords.length > 18) return "clue must have 3-18 words";
  if (answerPattern(entry.word).test(englishMeaning)) return "clue leaks the answer";
  if (
    englishMeaning.toLowerCase().replace(/[^a-z]+/g, " ").trim() ===
    entry.sourceDefinition.toLowerCase().replace(/[^a-z]+/g, " ").trim()
  ) {
    return "clue copies the source definition";
  }
  if (exampleWords.length < 4 || exampleWords.length > 16) {
    return "example must have 4-16 words";
  }
  if (!new RegExp(`\\b${entry.word}\\b`, "i").test(example)) {
    return "example omits the exact word";
  }
  if (!/[.!?]$/.test(example)) return "example needs ending punctuation";
  if (CHINESE_PATTERN.test(englishMeaning) || CHINESE_PATTERN.test(example)) {
    return "English field contains Chinese";
  }
  return null;
}

function normalizeModelOutput(raw) {
  const clean = raw.replace(ANSI_PATTERN, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model returned no JSON object");
  return JSON.parse(clean.slice(start, end + 1));
}

function buildPrompt(entries, previousError) {
  const keys = entries.map((entry) => entry.word).join(", ");
  return [
    "Create child-safe bilingual academic vocabulary content.",
    `Return ONLY one JSON object with exactly these keys: ${keys}.`,
    "Each value must be {zh, clue, example}.",
    "zh: concise Simplified Chinese meaning for the supplied sense.",
    "clue: an original natural English crossword clue of 3-18 words; paraphrase the source definition; never contain the key or any inflection of it.",
    "example: an original natural child-safe English sentence of 4-16 words; contain the exact lowercase key as a separate word; end with punctuation.",
    "Do not copy examples from any source, add keys, or omit keys.",
    previousError ? `Previous validation failed: ${previousError}` : "",
    `INPUT=${JSON.stringify(entries)}`
  ].join("\n");
}

function runModel(entries, previousError) {
  const result = spawnSync(
    "ollama",
    [
      "run",
      MODEL,
      "--format",
      "json",
      "--hidethinking",
      "--nowordwrap",
      buildPrompt(entries, previousError)
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" }
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Ollama exited ${result.status}: ${result.stderr.slice(0, 300)}`);
  }
  return normalizeModelOutput(result.stdout);
}

function authorBatch(entries) {
  const resolved = {};
  for (const entry of entries) {
    const override = EDITORIAL_OVERRIDES[entry.word];
    if (!override) continue;
    const problem = validateAuthored(entry, override);
    if (problem) {
      throw new Error(`Invalid editorial override for ${entry.word}: ${problem}`);
    }
    resolved[entry.word] = override;
  }
  let pending = entries.filter((entry) => !resolved[entry.word]);
  let previousError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length > 0; attempt += 1) {
    try {
      const output = runModel(pending, previousError);
      const failures = [];
      for (const entry of pending) {
        const problem = validateAuthored(entry, output[entry.word]);
        if (problem) failures.push(`${entry.word}: ${problem}`);
        else resolved[entry.word] = output[entry.word];
      }
      pending = entries.filter((entry) => !resolved[entry.word]);
      previousError = failures.join(" | ");
      if (pending.length > 0) {
        process.stderr.write(
          `  attempt ${attempt}/${MAX_ATTEMPTS}: ${previousError.slice(0, 300)}\n`
        );
      }
    } catch (error) {
      previousError = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `  attempt ${attempt}/${MAX_ATTEMPTS}: ${previousError.slice(0, 300)}\n`
      );
    }
  }
  if (pending.length > 0) {
    throw new Error(
      `Unable to author ${pending.map((entry) => entry.word).join(", ")}: ${previousError}`
    );
  }
  return resolved;
}

function readCheckpoint(path) {
  if (!existsSync(path)) return {};
  const checkpoint = JSON.parse(readFileSync(path, "utf8"));
  return checkpoint.model === MODEL && checkpoint.entries
    ? checkpoint.entries
    : {};
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dictionaryPath = requiredPath(args, "dictionary");
  const alphabetizedPath = requiredPath(args, "alphabetized");
  const outputPath = resolve(args.out ?? DEFAULT_OUTPUT);
  const checkpointPath = resolve(args.checkpoint ?? DEFAULT_CHECKPOINT);
  const dictionaryBytes = readFileSync(dictionaryPath);
  const alphabetizedBytes = readFileSync(alphabetizedPath);
  const alphabetized = parseAlphabetized(alphabetizedBytes.toString("utf8"));
  const parsedRows = parseDictionary(dictionaryBytes.toString("utf8"));
  const baselineCandidates = parsedRows
    .filter(
      (entry) =>
        entry.word.length <= 10 &&
        alphabetized.has(entry.word)
    )
    .sort((left, right) => left.rank - right.rank || left.word.localeCompare(right.word));
  const excludedCandidates = baselineCandidates
    .map((entry) => ({ ...entry, reasons: unsafeReasons(entry) }))
    .filter((entry) => entry.reasons.length > 0);
  const safeCandidates = baselineCandidates.filter(
    (entry) => unsafeReasons(entry).length === 0
  );
  const safetySelected = safeCandidates.slice(0, 600);
  const crosswordExcludedCandidates = safeCandidates.filter(
    (entry) => entry.word.length < 3
  );
  const selected = safeCandidates
    .filter((entry) => entry.word.length >= 3)
    .slice(0, 600);
  if (
    selected.length !== 600 ||
    new Set(selected.map((entry) => entry.word)).size !== 600 ||
    new Set(selected.map((entry) => entry.rank)).size !== 600
  ) {
    throw new Error(`Expected 600 unique eligible NAWL words, got ${selected.length}`);
  }
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > 20) {
    throw new Error("IELTS_AUTHOR_BATCH_SIZE must be an integer from 1 to 20");
  }
  const baselineTopWords = new Set(
    baselineCandidates.slice(0, 600).map((entry) => entry.word)
  );
  const safetyReplacementWords = safetySelected
    .filter((entry) => !baselineTopWords.has(entry.word))
    .map((entry) => entry.word);
  const safetySelectedWords = new Set(safetySelected.map((entry) => entry.word));
  const crosswordReplacementWords = selected
    .filter((entry) => !safetySelectedWords.has(entry.word))
    .map((entry) => entry.word);

  const authored = readCheckpoint(checkpointPath);
  const pending = selected.filter((entry) => !authored[entry.word]);
  const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
  process.stdout.write(
    `Safety audit excluded ${excludedCandidates.length} entries; selected ${safetyReplacementWords.length} replacements.\n` +
      `Crossword audit excluded ${crosswordExcludedCandidates.length} short entries; selected ${crosswordReplacementWords.length} replacements.\n` +
      `Authoring ${pending.length}/${selected.length} NAWL entries with ${MODEL}.\n`
  );
  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    const number = Math.floor(offset / BATCH_SIZE) + 1;
    process.stdout.write(
      `[${number}/${totalBatches}] ${batch[0].word}..${batch[batch.length - 1].word}\n`
    );
    Object.assign(authored, authorBatch(batch));
    writeJson(checkpointPath, {
      model: MODEL,
      updatedAt: new Date().toISOString(),
      entries: authored
    });
  }

  const provenanceId = `nawl-1.2:${sha256(alphabetizedBytes)}`;
  const usedEditorialOverrides = Object.fromEntries(
    selected
      .filter((entry) => EDITORIAL_OVERRIDES[entry.word])
      .map((entry) => [entry.word, EDITORIAL_OVERRIDES[entry.word]])
  );
  const words = selected.map((entry) => {
    const value = authored[entry.word];
    const problem = validateAuthored(entry, value);
    if (problem) throw new Error(`${entry.word}: ${problem}`);
    return {
      id: `ielts-nawl-v1-${entry.word}`,
      word: entry.word,
      displayText: entry.word,
      englishMeaning: String(value.clue).trim().replace(/[.]+$/, ""),
      chineseMeaning: String(value.zh).trim(),
      phonetic: entry.phonetic,
      partOfSpeech: entry.partOfSpeech,
      cefrLevel: entry.rank <= 300 ? "B2" : "C1",
      frequencyRank: entry.rank,
      examples: [String(value.example).trim()],
      tags: ["ielts-preparation", "nawl-1.2", "academic"],
      learningConcept: `nawl-1.2-r${entry.rank}-${entry.word}`,
      reviewStatus: "automated",
      source: {
        type: "ielts",
        listId: "NAWL-1.2",
        rank: entry.rank,
        provenanceId
      },
      rating: "all-ages"
    };
  });
  writeJson(outputPath, {
    manifest: {
      version: "ielts-nawl-v1-source-base-v1",
      generatedAt: "2026-08-04T00:00:00.000Z",
      generatorVersion: "ielts-nawl-authoring-v1",
      releaseStatus: "automated-beta",
      license: "CC-BY-SA-4.0",
      source: {
        listId: "NAWL-1.2",
        title: "New Academic Word List 1.2",
        author: "Browne, C., Culligan, B., & Phillips, J.",
        pageUrl: "https://www.newgeneralservicelist.com/new-academic-word-list",
        alphabetizedUrl:
          "https://static1.squarespace.com/static/64336926d7c6bb38965fdf3b/t/644e0e936f1c072f5a0503f8/1682837139514/NAWL_1.2_alphabetized_description.txt",
        dictionaryUrl: "https://www.linguaeruditio.com/Glossary/NAWL/NAWL_gloss.html",
        alphabetizedSha256: `sha256:${sha256(alphabetizedBytes)}`,
        dictionarySha256: `sha256:${sha256(dictionaryBytes)}`,
        provenanceId
      },
      model: MODEL,
      modelDigest: MODEL_DIGEST,
      editorialOverrides: {
        count: Object.keys(usedEditorialOverrides).length,
        words: Object.keys(usedEditorialOverrides),
        sha256: `sha256:${sha256(
          Buffer.from(JSON.stringify(usedEditorialOverrides), "utf8")
        )}`
      },
      safety: {
        policyVersion: "all-ages-v1",
        unsafeWordPatterns: UNSAFE_WORD_PATTERNS.map((pattern) => pattern.source),
        unsafeDefinitionPatterns: UNSAFE_DEFINITION_PATTERNS.map(
          (pattern) => pattern.source
        ),
        excludedCount: excludedCandidates.length,
        excludedWords: excludedCandidates.map((entry) => ({
          word: entry.word,
          rank: entry.rank,
          reasons: entry.reasons
        })),
        replacementCount: safetyReplacementWords.length,
        replacementWords: safetyReplacementWords
      },
      crosswordEligibility: {
        policyVersion: "crossword-min-3-v1",
        minimumLetters: 3,
        excludedCount: crosswordExcludedCandidates.length,
        excludedWords: crosswordExcludedCandidates.map((entry) => ({
          word: entry.word,
          rank: entry.rank
        })),
        replacementCount: crosswordReplacementWords.length,
        replacementWords: crosswordReplacementWords
      },
      wordCount: words.length
    },
    words
  });
  process.stdout.write(`Wrote ${words.length} authored words to ${outputPath}.\n`);
}

main();
