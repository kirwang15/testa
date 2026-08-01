const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapedJsonString(value) {
  return JSON.stringify(value).slice(1, -1);
}

function structuralFieldVariants(field, value) {
  const encoded = escapedJsonString(value);
  const jsonPattern = `"${field}":"${encoded}"`;
  const jsPattern = `${field}:"${encoded}"`;
  return [
    jsonPattern,
    escapedJsonString(jsonPattern),
    jsPattern
  ];
}

function createWordLeakSentinels(word) {
  const sentinels = new Map();
  const add = (token, label) => {
    if (typeof token === "string" && token.length > 0 && !sentinels.has(token)) {
      sentinels.set(token, label);
    }
  };
  const id = String(word.id ?? word.vocabularyWordId ?? "");
  const spelling = String(word.word ?? word.displayText ?? "");
  const english = String(word.englishMeaning ?? word.clue ?? "");
  const chinese = String(word.chineseMeaning ?? "");

  // Word ids are deliberately structural and unique, so direct matching is
  // safe even when a spelling itself is a common UI word such as WHAT.
  add(id, `word id ${id}`);

  for (const field of ["word", "displayText"]) {
    for (const token of structuralFieldVariants(field, spelling)) {
      add(token, `${field} for ${id}`);
    }
  }
  if (english) {
    add(english, `English clue for ${id}`);
    add(escapedJsonString(english), `escaped English clue for ${id}`);
    add(escapeHtml(english), `HTML English clue for ${id}`);
  }

  if (chinese) {
    // Chinese meanings are often one or two common characters that can occur
    // inside unrelated bilingual UI. Require an exact DOM node or a named
    // content field instead of matching a substring such as “这里” in prose.
    add(`>${escapeHtml(chinese)}<`, `exact Chinese clue node for ${id}`);
    for (const token of structuralFieldVariants("chineseMeaning", chinese)) {
      add(token, `chineseMeaning for ${id}`);
    }
  }

  return Array.from(sentinels, ([token, label]) => ({ token, label }));
}

function createLeakSentinels(words) {
  const sentinels = new Map();
  for (const word of words) {
    for (const sentinel of createWordLeakSentinels(word)) {
      if (!sentinels.has(sentinel.token)) {
        sentinels.set(sentinel.token, sentinel.label);
      }
    }
  }
  return Array.from(sentinels, ([token, label]) => ({ token, label }));
}

function scanTextForLeaks(text, words) {
  return scanTextForSentinels(text, createLeakSentinels(words));
}

function scanTextForSentinels(text, sentinels) {
  for (const sentinel of sentinels) {
    if (text.includes(sentinel.token)) return sentinel;
  }
  return undefined;
}

function listFilesRecursive(directory, predicate = () => true) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(path, predicate));
    } else if (entry.isFile() && predicate(path, statSync(path))) {
      files.push(path);
    }
  }
  return files;
}

module.exports = {
  createLeakSentinels,
  createWordLeakSentinels,
  listFilesRecursive,
  scanTextForLeaks,
  scanTextForSentinels,
  structuralFieldVariants
};
