#!/usr/bin/env node

const {
  getAllBooks,
  getAllWords,
  getResolvedLevels
} = require("../.test-dist/src/lib/vocabulary-loader.js");
const {
  analyzeCrosswordLayout
} = require("../.test-dist/src/lib/level-generator.js");

const books = getAllBooks();
const words = getAllWords();
const levels = getResolvedLevels();
const analyses = levels.map((level) =>
  analyzeCrosswordLayout({
    grid: level.grid,
    placements: level.targetWords.map((word, index) => ({
      index,
      word: word.word,
      start: word.start,
      direction: word.direction
    }))
  })
);

const stats = {
  books: books.length,
  levels: levels.length,
  levelsByBook: Object.fromEntries(
    books.map((book) => [
      book.id,
      levels.filter((level) => level.bookId === book.id).length
    ])
  ),
  words: words.length,
  uniqueSpellings: new Set(words.map((word) => word.word.toLowerCase())).size,
  sourceCoverage: words.filter(
    (word) =>
      word.source?.edition === "1997" &&
      word.source?.verification === "double-source" &&
      word.source.provenanceId
  ).length,
  connected: analyses.filter((analysis) => analysis.connected).length,
  acrossAndDown: analyses.filter((analysis) => analysis.hasAcrossAndDown).length,
  zeroConflict: analyses.filter(
    (analysis) =>
      analysis.conflicts.length === 0 &&
      analysis.unexpectedRuns.length === 0
  ).length,
  gridMax: {
    rows: Math.max(...levels.map((level) => level.grid.rows)),
    cols: Math.max(...levels.map((level) => level.grid.cols))
  }
};

process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
