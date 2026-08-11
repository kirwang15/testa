const { execFileSync } = require("node:child_process");
const { statSync } = require("node:fs");
const { resolve } = require("node:path");

const MAX_APK_BYTES = 50_000_000;
const REQUIRED_ABIS = ["armeabi-v7a", "arm64-v8a"];
const CATALOG_ENTRY = "assets/flutter_assets/assets/content/catalog.json";

function fail(message) {
  console.error(`Android APK gate failed: ${message}`);
  process.exit(1);
}

const apkArgument = process.argv[2];
if (!apkArgument) {
  fail("pass an APK path, for example: node scripts/check-android-apk.cjs path/to/app-release.apk");
}

const apkPath = resolve(apkArgument);
let apkSize;
try {
  const stats = statSync(apkPath);
  if (!stats.isFile()) fail(`${apkPath} is not a file`);
  apkSize = stats.size;
} catch (error) {
  fail(`cannot read ${apkPath}: ${error.message}`);
}

if (apkSize >= MAX_APK_BYTES) {
  fail(`${apkPath} is ${apkSize} bytes; it must be smaller than ${MAX_APK_BYTES} bytes`);
}

let entries;
try {
  entries = execFileSync("unzip", ["-Z1", apkPath], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
} catch (error) {
  fail(`cannot inspect ZIP entries in ${apkPath}: ${error.message}`);
}

const nativeEntries = entries.filter((entry) => entry.startsWith("lib/"));
const packagedAbis = new Set(
  nativeEntries.map((entry) => entry.split("/")[1]).filter(Boolean)
);

for (const abi of REQUIRED_ABIS) {
  if (!packagedAbis.has(abi)) {
    fail(`required ABI ${abi} is missing; found: ${[...packagedAbis].sort().join(", ") || "none"}`);
  }
  for (const library of ["libapp.so", "libflutter.so"]) {
    if (!nativeEntries.includes(`lib/${abi}/${library}`)) {
      fail(`lib/${abi}/${library} is missing`);
    }
  }
}

if (packagedAbis.has("x86_64")) {
  fail("x86_64 must not be packaged");
}

const unexpectedAbis = [...packagedAbis].filter((abi) => !REQUIRED_ABIS.includes(abi));
if (unexpectedAbis.length > 0) {
  fail(`unexpected ABI(s): ${unexpectedAbis.sort().join(", ")}`);
}

if (!entries.includes(CATALOG_ENTRY)) {
  fail(`embedded curriculum catalog is missing: ${CATALOG_ENTRY}`);
}

let catalog;
try {
  catalog = JSON.parse(
    execFileSync("unzip", ["-p", apkPath, CATALOG_ENTRY], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    })
  );
} catch (error) {
  fail(`cannot read embedded curriculum catalog: ${error.message}`);
}

const curricula = Array.isArray(catalog.curricula) ? catalog.curricula : [];
const tracks = Array.isArray(catalog.tracks) ? catalog.tracks : [];
const levels = Array.isArray(catalog.levels) ? catalog.levels : [];
const nceLevels = levels.filter((level) => level.curriculumId === "nce-1997");
const ieltsLevels = levels.filter(
  (level) => level.curriculumId === "ielts-nawl-v1"
);
if (
  catalog.schemaVersion !== 1 ||
  typeof catalog.contentVersion !== "string" ||
  !catalog.contentVersion.startsWith("word-trail-") ||
  curricula.length !== 2 ||
  tracks.length !== 8 ||
  levels.length !== 600 ||
  nceLevels.length !== 400 ||
  ieltsLevels.length !== 200 ||
  new Set(levels.map((level) => level.id)).size !== 600
) {
  fail(
    `embedded catalog topology is invalid: version=${catalog.contentVersion || "missing"}, ` +
      `curricula=${curricula.length}, tracks=${tracks.length}, levels=${levels.length}, ` +
      `NCE=${nceLevels.length}, IELTS=${ieltsLevels.length}`
  );
}

const curriculumIds = curricula.map((curriculum) => curriculum.id).sort();
if (
  JSON.stringify(curriculumIds) !==
  JSON.stringify(["ielts-nawl-v1", "nce-1997"])
) {
  fail(`embedded curriculum ids are invalid: ${curriculumIds.join(",")}`);
}

const requiredTrackCounts = Object.fromEntries([
  ...[1, 2, 3, 4].map((book) => [`nce-1997-b${book}`, 100]),
  ...[1, 2, 3, 4].map((stage) => [`ielts-nawl-v1-s${stage}`, 50])
]);

for (const track of tracks) {
  const expectedCount = requiredTrackCounts[track.id];
  const actualLevelIds = levels
    .filter((level) => level.trackId === track.id)
    .map((level) => level.id)
    .sort();
  const declaredLevelIds = Array.isArray(track.levelIds)
    ? [...track.levelIds].sort()
    : [];
  if (
    !expectedCount ||
    declaredLevelIds.length !== expectedCount ||
    actualLevelIds.length !== expectedCount ||
    JSON.stringify(declaredLevelIds) !== JSON.stringify(actualLevelIds)
  ) {
    fail(`embedded track ${track.id || "unknown"} has ${track.levelIds?.length ?? 0} levels`);
  }
}

const assetPaths = new Set();
for (const level of levels) {
  if (
    typeof level.assetPath !== "string" ||
    !/^assets\/content\/levels\/[a-z0-9-]+\.json$/.test(level.assetPath) ||
    assetPaths.has(level.assetPath)
  ) {
    fail(`embedded level ${level.id || "unknown"} has an invalid asset path`);
  }
  assetPaths.add(level.assetPath);
  const assetEntry = `assets/flutter_assets/${level.assetPath}`;
  if (!entries.includes(assetEntry)) {
    fail(`embedded level asset is missing: ${assetEntry}`);
  }
}

console.log(
  `Android APK gate passed: ${apkSize} bytes; ABIs: ${REQUIRED_ABIS.join(", ")}; ` +
    `catalog ${catalog.contentVersion}: 400 NCE + 200 IELTS`
);
