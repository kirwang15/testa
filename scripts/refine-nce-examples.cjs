#!/usr/bin/env node

/* Offline, resumable example-sentence authoring for the NCE curriculum. */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_PATH = path.join(
  ROOT,
  "src/content/vocabulary/generated/nce-1997.json",
);
const CHECKPOINT_PATH =
  process.env.NCE_EXAMPLE_CHECKPOINT ||
  "/private/tmp/nce-example-refinement-checkpoint.json";
const MODEL = process.env.NCE_EXAMPLE_MODEL || "gemma4:e4b";
const MODEL_DIGEST =
  process.env.NCE_EXAMPLE_MODEL_DIGEST ||
  "sha256:4c27e0f5b5adf02ac956c7322bd2ee7636fe3f45a8512c9aba5385242cb6e09a";
const BATCH_SIZE = Number(process.env.NCE_EXAMPLE_BATCH_SIZE || 24);
const MAX_ATTEMPTS = Number(process.env.NCE_EXAMPLE_MAX_ATTEMPTS || 4);
const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const CHINESE_PATTERN = /[\u3400-\u9fff]/u;
const GENERIC_PATTERN = /after this lesson|own sentence|practice (?:the )?word|example sentence/i;
const CURATED_OVERRIDES = {
  bank: "Mia deposited her birthday money at the bank.",
  backward: "The village once lacked roads and seemed backward.",
  bar: "The café has a juice bar beside the window.",
  bearing: "The rain has no bearing on our indoor rehearsal.",
  bill: "Dad checked the restaurant bill before paying.",
  call: "We call on Grandma every Sunday afternoon.",
  card: "The picture card from Paris arrived on Tuesday.",
  cellar: "We stored apples and potatoes in the cool cellar.",
  cherish: "Mia continued to cherish the hope of joining the team.",
  club: "Our chess club meets after school on Fridays.",
  close: "Mia and Zoe are close friends at school.",
  compact: "Mum opened her compact to check the mirror.",
  consist: "The model will consist of wood and recycled paper.",
  confine: "The fence marked the narrow confine of the garden.",
  direct: "This path leads direct to the playground entrance.",
  drove: "A drove of cattle crossed the dusty road.",
  fan: "Mia is a devoted fan of the school basketball team.",
  gilt: "The class learned that a gilt is a government bond.",
  goodwill: "Their helpful welcome created goodwill between the teams.",
  insoluble: "The insoluble powder remained at the bottom of the jar.",
  intoxicate: "Sudden praise can intoxicate an inexperienced performer.",
  last: "We caught the last bus home after the concert.",
  landlord: "The landlord welcomed everyone into the small village pub.",
  line: "This bus line connects our village to the city.",
  mean: "It was mean of Ben to keep every snack.",
  mum: "My mum packed fruit for our picnic.",
  nerve: "A damaged nerve can make your fingers feel numb.",
  note: "The cashier returned a five-pound note with my change.",
  oppress: "Persistent worries can oppress a tired mind.",
  orgy: "The report described an orgy of waste and noise.",
  pool: "The players added pretend coins to the pool before the game.",
  rest: "Rest the ladder firmly against the garden wall.",
  ring: "Tall trees ring the quiet lake.",
  rub: "The rub is finding enough time before sunset.",
  secretary: "The secretary organized the meeting notes and appointments.",
  seem: "The task may seem difficult until we work together.",
  settlement: "The settlers built a small settlement beside the river.",
  sort: "This sort of puzzle becomes easier with practice.",
  speed: "The road sign limits speed near the school.",
  state: "The notice will state the new school rules clearly.",
  swing: "The boat began to swing toward the harbour entrance.",
  tyre: "A sharp stone punctured the bicycle tyre.",
  turn: "His polite turn impressed everyone at the table.",
  administer: "Ms Chen will administer the school art program.",
  arrest: "Police may arrest a thief after gathering clear evidence.",
  bullfight:
    "The documentary explained why the traditional bullfight remains controversial.",
  champagne: "Adults toasted the anniversary with a small glass of champagne.",
  cobra: "A cobra raised its hood in the wildlife film.",
  convulsive: "A convulsive cough interrupted the quiet performance.",
  imprison: "The ruler threatened to imprison anyone who opposed him.",
  kidnapper: "The kidnapper appears only as a fictional story villain.",
  lash: "Storm winds lash the windows throughout the night.",
  prosecute: "Authorities may prosecute anyone who steals protected wildlife.",
  riot: "The garden was a riot of colour in spring.",
  roll: "The small boat began to roll in the rough waves.",
  snatch: "We heard a snatch of music through the open window.",
  spasm: "A spasm of laughter interrupted the serious rehearsal.",
  torpedo: "In the naval game, players can torpedo an empty ship.",
  tussle: "The puppies had a playful tussle over the toy.",
  venom: "The snake's venom can harm small animals.",
  wreck: "After the exhausting journey, he felt like a complete wreck.",
  vulgar: "The critic disliked the vulgar decoration in the hall.",
  wasp: "A wasp hovered near the ripe pears.",
  whisky: "The museum displayed an old whisky bottle behind glass.",
  blur: "Rain can blur the view through the classroom window.",
  zip: "The zip on Leo's school bag got stuck.",
};

function normalize(value) {
  return value
    .replace(ANSI_PATTERN, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

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

function answerPattern(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function validateExample(word, sentence) {
  if (typeof sentence !== "string") return "not a string";
  const trimmed = sentence.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4 || wordCount > 16) {
    return `must contain 4-16 words (got ${wordCount})`;
  }
  if (!answerPattern(word).test(trimmed)) return "does not contain the target word";
  if (CHINESE_PATTERN.test(trimmed)) return "contains Chinese text";
  if (GENERIC_PATTERN.test(trimmed)) return "uses a generic learning template";
  if (/[{}<>]/.test(trimmed)) return "contains markup or braces";
  if (!/[.!?]$/.test(trimmed)) return "needs ending punctuation";
  return null;
}

function parseJsonObject(raw) {
  const cleaned = normalize(raw);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model returned no JSON object");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function buildPrompt(entries, previousError) {
  return [
    "Write one original English example sentence for each vocabulary item.",
    "Return ONLY a valid JSON object mapping every lowercase word key to its sentence.",
    "Treat zh and clue as the authoritative intended sense, including uncommon senses.",
    "Each sentence must contain the exact word key as a separate word, use it grammatically, contain 4-16 words, and end with punctuation.",
    "Use varied child-safe situations suitable for ages 7-15. Do not copy textbook wording, mention lessons, or use a reusable template.",
    "Do not omit or add keys.",
    previousError ? `Previous validation error: ${previousError}` : "",
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
    throw new Error(`Ollama exited ${result.status}: ${normalize(result.stderr).slice(0, 200)}`);
  }
  return parseJsonObject(result.stdout);
}

function refineBatch(words) {
  const allEntries = words.map((word) => ({
    word: word.word.toLowerCase(),
    pos: word.partOfSpeech,
    zh: word.chineseMeaning,
    clue: word.englishMeaning,
  }));
  let entries = allEntries;
  const refined = {};
  let previousError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = runModel(entries, previousError);
      const expected = entries.map((entry) => entry.word).sort();
      const actual = Object.keys(result).sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error(`keys differ; expected ${expected.join(",")}; got ${actual.join(",")}`);
      }
      const failures = [];
      for (const entry of entries) {
        const sentence = String(result[entry.word] || "").trim();
        const problem = validateExample(entry.word, sentence);
        if (problem) failures.push(`${entry.word}: ${problem}: ${sentence}`);
        else refined[entry.word] = sentence;
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
  throw new Error(`Could not refine batch: ${previousError}`);
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return {};
  const checkpoint = readJson(CHECKPOINT_PATH);
  return checkpoint.model === MODEL && checkpoint.examples
    ? checkpoint.examples
    : {};
}

function main() {
  const content = readJson(CONTENT_PATH);
  const words = collectWords(content);
  const examples = loadCheckpoint();
  const pending = words.filter((word) => {
    const key = word.word.toLowerCase();
    return !examples[key] && !CURATED_OVERRIDES[key];
  });
  const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
  process.stdout.write(
    `Refining ${pending.length}/${words.length} examples with ${MODEL} in ${totalBatches} batches.\n`,
  );

  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);
    const number = Math.floor(offset / BATCH_SIZE) + 1;
    process.stdout.write(
      `[${number}/${totalBatches}] ${batch[0].word}..${batch[batch.length - 1].word}\n`,
    );
    Object.assign(examples, refineBatch(batch));
    writeJson(CHECKPOINT_PATH, {
      model: MODEL,
      updatedAt: new Date().toISOString(),
      examples,
    });
  }

  const authoredExamples = new Map();
  for (const word of words) {
    const key = word.word.toLowerCase();
    const sentence = CURATED_OVERRIDES[key] || examples[key];
    const problem = validateExample(key, sentence);
    if (problem) throw new Error(`${key}: ${problem}`);
    authoredExamples.set(word.id, sentence);
  }

  // Another content-authoring pass may run while Ollama is generating. Re-read
  // the latest artifact and merge only examples so clue/source fixes are never
  // overwritten by the long-running generation snapshot.
  const latestContent = readJson(CONTENT_PATH);
  const latestWords = collectWords(latestContent);
  if (latestWords.length !== words.length) {
    throw new Error(
      `Content changed during generation: expected ${words.length} words, got ${latestWords.length}`,
    );
  }
  for (const word of latestWords) {
    const sentence = authoredExamples.get(word.id);
    if (!sentence) throw new Error(`Content changed during generation: missing ${word.id}`);
    word.examples = [sentence];
  }
  latestContent.manifest.exampleGenerator = {
    runtime: "ollama",
    model: MODEL,
    modelDigest: MODEL_DIGEST,
    script: "scripts/refine-nce-examples.cjs",
    policyVersion: "child-example-v1",
  };
  writeJson(CONTENT_PATH, latestContent);
  process.stdout.write(`Applied ${latestWords.length} validated examples.\n`);
}

main();
