const {
  existsSync,
  readFileSync
} = require("node:fs");
const { relative, resolve } = require("node:path");
const { gzipSync } = require("node:zlib");
const {
  createLeakSentinels,
  listFilesRecursive,
  scanTextForSentinels
} = require("./bundle-boundary-helpers.cjs");

const ROOT = resolve(__dirname, "..");
const APP_BUILD_ROOT = resolve(ROOT, ".next/server/app");
const curriculumIndex = require(resolve(
  ROOT,
  "src/content/vocabulary/generated/curriculum-index.json"
));
const corpus = require(resolve(
  ROOT,
  "src/content/vocabulary/generated/nce-1997.json"
));

const allWords = corpus.books.flatMap((book) =>
  book.units.flatMap((unit) => unit.words)
);
const allContentSentinels = createLeakSentinels(allWords);
const fileCache = new Map();
const scriptStatCache = new Map();
const initialScriptLeakCache = new Map();
const initialScriptFileLeakCache = new Map();
let failed = false;

function readText(path) {
  if (!fileCache.has(path)) fileCache.set(path, readFileSync(path, "utf8"));
  return fileCache.get(path);
}

function runtimeFileKey(id) {
  return id.replace(/[^A-Za-z0-9._-]/g, (character) =>
    `_${character.codePointAt(0)?.toString(16) ?? "0"}_`
  );
}

function getRouteArtifacts(htmlPath) {
  const base = htmlPath.slice(0, -".html".length);
  const rscPath = `${base}.rsc`;
  const segmentRoot = `${base}.segments`;
  const required = [htmlPath, rscPath, segmentRoot];
  const missing = required.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(
      `${relative(ROOT, htmlPath)}: missing build artifact(s): ${missing
        .map((path) => relative(ROOT, path))
        .join(", ")}`
    );
  }
  return [
    htmlPath,
    rscPath,
    ...listFilesRecursive(segmentRoot, (path) => path.endsWith(".rsc"))
  ];
}

function getInitialScripts(htmlPath) {
  const html = readText(htmlPath);
  const scripts = [];
  const pattern = /<script\b([^>]*)><\/script>/g;
  for (const match of html.matchAll(pattern)) {
    if (/\bnomodule\b/i.test(match[1])) continue;
    const sourceMatch = /\bsrc=(["'])(.*?)\1/.exec(match[1]);
    if (!sourceMatch) continue;
    const source = sourceMatch[2].split("?")[0];
    if (!source.startsWith("/_next/static/")) continue;
    scripts.push(resolve(ROOT, `.next${source.slice("/_next".length)}`));
  }
  return Array.from(new Set(scripts)).sort();
}

function getScriptStats(path) {
  if (!scriptStatCache.has(path)) {
    if (!existsSync(path)) {
      throw new Error(`${relative(ROOT, path)}: initial client script is missing.`);
    }
    const source = readFileSync(path);
    scriptStatCache.set(path, {
      gzipBytes: gzipSync(source, { level: 9 }).byteLength,
      text: source.toString("utf8")
    });
  }
  return scriptStatCache.get(path);
}

function scanInitialScripts(routeName, scripts) {
  const signature = scripts.join("\u0000");
  if (!initialScriptLeakCache.has(signature)) {
    let leak;
    let leakPath;
    for (const script of scripts) {
      if (!initialScriptFileLeakCache.has(script)) {
        initialScriptFileLeakCache.set(
          script,
          scanTextForSentinels(
            getScriptStats(script).text,
            allContentSentinels
          )
        );
      }
      leak = initialScriptFileLeakCache.get(script);
      if (leak) {
        leakPath = script;
        break;
      }
    }
    initialScriptLeakCache.set(signature, { leak, leakPath, reported: false });
  }
  const result = initialScriptLeakCache.get(signature);
  if (result.leak && !result.reported) {
    console.error(
      `${routeName}: ${result.leak.label} leaked into modern initial JS (${relative(
        ROOT,
        result.leakPath
      )}).`
    );
    result.reported = true;
    failed = true;
  }
}

function checkRoute({ name, htmlPath, budgetKb, sentinels }) {
  const artifactPaths = getRouteArtifacts(htmlPath);
  const serverText = artifactPaths.map(readText).join("\n");
  const serverLeak = scanTextForSentinels(serverText, sentinels);
  if (serverLeak) {
    console.error(`${name}: ${serverLeak.label} leaked into HTML/RSC/segments.`);
    failed = true;
  }

  const scripts = getInitialScripts(htmlPath);
  if (scripts.length === 0) {
    console.error(`${name}: no modern initial scripts were found.`);
    failed = true;
  }
  scanInitialScripts(name, scripts);
  const gzipKb = scripts.reduce(
    (sum, script) => sum + getScriptStats(script).gzipBytes,
    0
  ) / 1024;
  if (gzipKb > budgetKb) {
    console.error(
      `${name}: ${gzipKb.toFixed(1)}KB exceeds ${budgetKb}KB initial-JS budget by ${(
        gzipKb - budgetKb
      ).toFixed(1)}KB.`
    );
    failed = true;
  }
  return { gzipKb, artifactCount: artifactPaths.length, scriptCount: scripts.length };
}

function routeWordsFromBundle(bundle) {
  const vocabularyById = new Map(bundle.vocabulary.map((word) => [word.id, word]));
  return bundle.level.targetWords.map((target) => {
    const vocabulary = vocabularyById.get(target.vocabularyWordId ?? target.id) ?? {};
    return {
      ...vocabulary,
      ...target,
      id: target.id,
      word: target.word,
      englishMeaning: target.englishMeaning ?? target.clue,
      chineseMeaning: target.chineseMeaning ?? vocabulary.chineseMeaning
    };
  });
}

if (curriculumIndex.levels.length !== 800) {
  throw new Error(
    `Expected 800 formal levels, found ${curriculumIndex.levels.length}.`
  );
}

const gameStats = [];
for (const level of curriculumIndex.levels) {
  const htmlPath = resolve(APP_BUILD_ROOT, `levels/${level.id}.html`);
  const runtimePath = resolve(
    ROOT,
    `public/content/runtime/levels/${runtimeFileKey(level.id)}.json`
  );
  if (!existsSync(runtimePath)) {
    throw new Error(`${level.id}: runtime bundle is missing.`);
  }
  const bundle = JSON.parse(readText(runtimePath));
  if (bundle.level?.id !== level.id) {
    throw new Error(`${level.id}: runtime bundle id does not match its route.`);
  }
  gameStats.push(
    checkRoute({
      name: `/levels/${level.id}`,
      htmlPath,
      budgetKb: 220,
      sentinels: createLeakSentinels(routeWordsFromBundle(bundle))
    })
  );
}

const nonGameHtmlPaths = listFilesRecursive(APP_BUILD_ROOT, (path) =>
  path.endsWith(".html") &&
  !path.includes("/levels/") &&
  !path.endsWith("/_not-found.html") &&
  !path.endsWith("/_global-error.html")
);
const coreStats = [];
for (const htmlPath of nonGameHtmlPaths) {
  const buildRelative = relative(APP_BUILD_ROOT, htmlPath);
  const routeName = buildRelative === "index.html"
    ? "/"
    : `/${buildRelative.slice(0, -".html".length)}`;
  coreStats.push(
    checkRoute({
      name: routeName,
      htmlPath,
      budgetKb: routeName === "/review" ? 220 : 180,
      sentinels: allContentSentinels
    })
  );
}

const maxGameKb = Math.max(...gameStats.map((stats) => stats.gzipKb));
const maxCoreKb = Math.max(...coreStats.map((stats) => stats.gzipKb));
const gameArtifactCount = gameStats.reduce(
  (sum, stats) => sum + stats.artifactCount,
  0
);
const coreArtifactCount = coreStats.reduce(
  (sum, stats) => sum + stats.artifactCount,
  0
);

console.log(
  `answer boundary: checked ${gameStats.length}/800 formal level routes (${gameArtifactCount} HTML/RSC/segment artifacts)`
);
console.log(
  `answer boundary: checked ${coreStats.length} non-game routes (${coreArtifactCount} HTML/RSC/segment artifacts)`
);
console.log(
  `initial JS: ${initialScriptLeakCache.size} distinct route bundles; max game ${maxGameKb.toFixed(
    1
  )}KB gzip, max non-game ${maxCoreKb.toFixed(1)}KB gzip`
);

if (failed) process.exitCode = 1;
