#!/usr/bin/env node

const { performance } = require("node:perf_hooks");

let loader;
try {
  loader = require("../.test-dist/src/lib/vocabulary-loader.js");
} catch {
  throw new Error("Run `npm test` before the curriculum benchmark.");
}

function measure(iterations, operation) {
  const started = performance.now();
  for (let index = 0; index < iterations; index += 1) operation();
  return (performance.now() - started) / iterations;
}

const books = loader.getAllBooks();
const progressOperation = () => {
  for (const book of books) loader.getBookProgress(book.id, {}, {});
};

const uncachedGenerationMs = measure(5, () => {
  loader.resetCurriculumLevelCacheForDiagnostics();
  loader.getResolvedLevels();
});
loader.resetCurriculumLevelCacheForDiagnostics();
loader.getResolvedLevels();
const cachedGenerationMs = measure(50, () => loader.getResolvedLevels());

const uncachedProgressMs = measure(5, () => {
  loader.resetCurriculumLevelCacheForDiagnostics();
  progressOperation();
});
loader.resetCurriculumLevelCacheForDiagnostics();
loader.getResolvedLevels();
const cachedProgressMs = measure(50, progressOperation);

process.stdout.write(
  `${JSON.stringify(
    {
      simulatedBeforeCache: {
        fullCurriculumGenerationMs: Number(uncachedGenerationMs.toFixed(3)),
        fourBookProgressMs: Number(uncachedProgressMs.toFixed(3)),
      },
      afterCache: {
        fullCurriculumGenerationMs: Number(cachedGenerationMs.toFixed(3)),
        fourBookProgressMs: Number(cachedProgressMs.toFixed(3)),
        cachedUnits: loader.getCurriculumLevelCacheSize(),
      },
      speedup: {
        generation: Number((uncachedGenerationMs / cachedGenerationMs).toFixed(1)),
        progress: Number((uncachedProgressMs / cachedProgressMs).toFixed(1)),
      },
    },
    null,
    2,
  )}\n`,
);
