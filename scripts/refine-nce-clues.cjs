#!/usr/bin/env node

/*
 * Offline authoring helper for the generated NCE curriculum.
 *
 * This script is intentionally not part of the application runtime. It asks a
 * locally installed Ollama model to rewrite each English clue so that it
 * matches the supplied Chinese sense, then applies the result only after every
 * clue passes deterministic safety checks. A checkpoint makes the run
 * resumable without partially rewriting the checked-in curriculum.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_PATH = path.join(
  ROOT,
  "src/content/vocabulary/generated/nce-1997.json",
);
const CHECKPOINT_PATH =
  process.env.NCE_CLUE_CHECKPOINT ||
  "/private/tmp/nce-clue-refinement-checkpoint.json";
const MODEL = process.env.NCE_CLUE_MODEL || "gemma4:e4b";
const MODEL_DIGEST =
  process.env.NCE_CLUE_MODEL_DIGEST ||
  "sha256:4c27e0f5b5adf02ac956c7322bd2ee7636fe3f45a8512c9aba5385242cb6e09a";
const BATCH_SIZE = Number(process.env.NCE_CLUE_BATCH_SIZE || 24);
const MAX_ATTEMPTS = Number(process.env.NCE_CLUE_MAX_ATTEMPTS || 4);

const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const CHINESE_PATTERN = /[\u3400-\u9fff]/u;
const GENERIC_PATTERN = /\b(?:a|an|the)?\s*(?:english\s+)?word\s+(?:that|for|meaning)\b/i;
const CURATED_OVERRIDES = {
  acrobatic: "Involving skilled balancing, jumping, or tumbling movements",
  bank: "Place where people safely keep and manage money",
  bar: "A counter or room where drinks are served",
  bill: "Written list of charges that must be paid",
  call: "To visit a person or place for a short time",
  card: "Small illustrated message sent through the post",
  cherish: "To keep a hope or wish firmly in your mind",
  club: "Group where people meet for a shared interest",
  consist: "To be made up of particular people or things",
  goodwill: "Friendly and helpful feeling toward other people",
  evening: "The later part of the day before bedtime",
  insoluble: "Unable to dissolve in a liquid",
  intoxicate: "To fill someone with overwhelming excitement or delight",
  mean: "Unwilling to spend, give, or share with others",
  monstrous: "Unnaturally large or frighteningly misshapen",
  mum: "Informal British name used for one's mother",
  oppress: "To weigh heavily on someone's mind or feelings",
  orgy: "An excessive amount of uncontrolled activity",
  rest: "To lean or place something on a supporting surface",
  rub: "The difficult part of a situation",
  secretary: "Office assistant who organizes records, messages, and appointments",
  settlement: "A new place where people establish homes",
  shopping: "The activity of buying goods",
  speed: "Rate at which something moves, often limited on roads",
  swing: "To turn quickly toward another direction",
  tyre: "Rubber ring fitted around a vehicle wheel",
  turn: "A particular way that someone behaves",
  vulgar: "Ordinary and lacking good taste or refinement",
  wasp: "Yellow-and-black flying insect that can sting",
  landlord: "Person who owns or runs a pub or rented property",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function collectWords(content) {
  return content.books.flatMap((book) =>
    book.units.flatMap((unit) => unit.words),
  );
}

function normalize(value) {
  return value
    .replace(ANSI_PATTERN, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function parseJsonObject(raw) {
  const cleaned = normalize(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error(`Model returned no JSON object: ${cleaned.slice(0, 180)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function answerPattern(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(?:s|es|ed|ing)?\\b`, "i");
}

function validateClue(word, clue) {
  if (typeof clue !== "string") return "not a string";
  const trimmed = clue.trim();
  const count = trimmed.split(/\s+/).filter(Boolean).length;
  if (count < 3 || count > 18) return `must contain 3-18 words (got ${count})`;
  if (CHINESE_PATTERN.test(trimmed)) return "contains Chinese text";
  if (answerPattern(word).test(trimmed)) return "contains the answer or an inflection";
  if (GENERIC_PATTERN.test(trimmed)) return "uses a generic placeholder definition";
  if (/[{}<>]/.test(trimmed)) return "contains markup or braces";
  return null;
}

function buildPrompt(entries, previousError) {
  const retryNote = previousError
    ? `The previous response failed validation: ${previousError}. Correct that exact problem.\n`
    : "";
  return [
    "You are writing concise crossword clues for children learning English.",
    "Return ONLY one valid JSON object mapping each supplied word to one English clue.",
    "Use the supplied Chinese meaning as the authoritative sense, even when another sense is more common.",
    "Each clue must be 3-18 English words, natural, concrete, child-safe, and understandable without the answer.",
    "CRITICAL: a JSON key is the forbidden answer for its value. Never repeat that key in its value, even at the beginning of a question.",
    "Also never include a grammatical inflection of the answer, Chinese text, example sentences, quotation marks around blanks, or textbook wording.",
    "For question words and function words, describe their grammatical purpose without using the answer (example style: Question term asking for a person).",
    "Do not omit or add keys. Preserve each lowercase key exactly.",
    retryNote,
    `INPUT=${JSON.stringify(entries)}`,
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
      buildPrompt(entries, previousError),
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: 180_000,
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Ollama exited ${result.status}: ${normalize(result.stderr || result.stdout).slice(0, 300)}`,
    );
  }
  return parseJsonObject(result.stdout);
}

function refineBatch(words) {
  const allEntries = words.map((word) => ({
    word: word.word.toLowerCase(),
    pos: word.partOfSpeech,
    zh: word.chineseMeaning,
    forbidden: word.word.toLowerCase(),
  }));
  let entries = allEntries;
  const refined = {};
  let previousError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = runModel(entries, previousError);
      const expected = entries.map((entry) => entry.word).sort();
      const actual = Object.keys(result).sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `keys differ; expected ${expected.join(", ")}; got ${actual.join(", ")}`,
        );
      }

      const failures = [];
      for (const entry of entries) {
        const clue = String(result[entry.word] || "").trim().replace(/[.。]+$/, "");
        const problem = validateClue(entry.word, clue);
        if (problem) {
          failures.push(`${entry.word}: ${problem}: ${clue}`);
        } else {
          refined[entry.word] = clue;
        }
      }
      if (failures.length === 0) return refined;
      entries = allEntries.filter((entry) => !refined[entry.word]);
      throw new Error(failures.join(" | "));
    } catch (error) {
      previousError = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `  attempt ${attempt}/${MAX_ATTEMPTS} failed: ${previousError.slice(0, 240)}\n`,
      );
    }
  }
  const unresolved = allEntries
    .filter((entry) => !refined[entry.word])
    .map((entry) => entry.word)
    .join(", ");
  throw new Error(
    `Could not refine ${unresolved} after ${MAX_ATTEMPTS} attempts: ${previousError}`,
  );
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return {};
  const checkpoint = readJson(CHECKPOINT_PATH);
  return checkpoint.model === MODEL && checkpoint.clues
    ? checkpoint.clues
    : {};
}

function main() {
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > 50) {
    throw new Error("NCE_CLUE_BATCH_SIZE must be an integer from 1 to 50");
  }

  const content = readJson(CONTENT_PATH);
  const words = collectWords(content);
  const clues = loadCheckpoint();
  const pending = words.filter((word) => !clues[word.word.toLowerCase()]);
  const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

  process.stdout.write(
    `Refining ${pending.length}/${words.length} clues with ${MODEL} in ${totalBatches} batches.\n`,
  );

  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    const number = Math.floor(offset / BATCH_SIZE) + 1;
    process.stdout.write(
      `[${number}/${totalBatches}] ${batch[0].word}..${batch[batch.length - 1].word}\n`,
    );
    Object.assign(clues, refineBatch(batch));
    writeJson(CHECKPOINT_PATH, {
      model: MODEL,
      updatedAt: new Date().toISOString(),
      clues,
    });
  }

  for (const word of words) {
    const key = word.word.toLowerCase();
    const clue = CURATED_OVERRIDES[key] || clues[key];
    const problem = validateClue(word.word, clue);
    if (problem) throw new Error(`${word.word}: ${problem}`);
    word.englishMeaning = clue;
  }

  content.manifest.generatorVersion = "crossword-content-v1.1-sense-aligned";
  content.manifest.clueGenerator = {
    runtime: "ollama",
    model: MODEL,
    modelDigest: MODEL_DIGEST,
    script: "scripts/refine-nce-clues.cjs",
    policyVersion: "child-crossword-clue-v1",
  };
  content.manifest.notice =
    "Unofficial personal-learning data. Book and lesson mappings were cross-checked against two public indexes; locally generated clues are not textbook text.";
  writeJson(CONTENT_PATH, content);
  process.stdout.write(`Applied ${words.length} validated clues to ${CONTENT_PATH}.\n`);
}

main();
