const { execFileSync } = require("node:child_process");
const { readFileSync, statSync } = require("node:fs");
const { resolve } = require("node:path");

const MAX_APK_BYTES = 50_000_000;
const REQUIRED_ABIS = ["armeabi-v7a", "arm64-v8a"];
const CATALOG_ENTRY = "assets/flutter_assets/assets/content/catalog.json";
const ASSESSMENT_ENTRY =
  "assets/flutter_assets/assets/content/assessment/bank-v1.json";
const EXPECTED_ASSESSMENT_PATH = resolve(
  __dirname,
  "../word_trail_flutter/assets/content/assessment/bank-v1.json"
);

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
const kaoyanLevels = levels.filter(
  (level) => level.curriculumId === "kaoyan-core-v1"
);
if (
  catalog.schemaVersion !== 1 ||
  typeof catalog.contentVersion !== "string" ||
  !catalog.contentVersion.startsWith("word-trail-") ||
  curricula.length !== 3 ||
  tracks.length !== 12 ||
  levels.length !== 800 ||
  nceLevels.length !== 400 ||
  ieltsLevels.length !== 200 ||
  kaoyanLevels.length !== 200 ||
  new Set(levels.map((level) => level.id)).size !== 800
) {
  fail(
    `embedded catalog topology is invalid: version=${catalog.contentVersion || "missing"}, ` +
      `curricula=${curricula.length}, tracks=${tracks.length}, levels=${levels.length}, ` +
      `NCE=${nceLevels.length}, IELTS=${ieltsLevels.length}, Kaoyan=${kaoyanLevels.length}`
  );
}

const curriculumIds = curricula.map((curriculum) => curriculum.id).sort();
if (
  JSON.stringify(curriculumIds) !==
  JSON.stringify(["ielts-nawl-v1", "kaoyan-core-v1", "nce-1997"])
) {
  fail(`embedded curriculum ids are invalid: ${curriculumIds.join(",")}`);
}

const requiredTrackCounts = Object.fromEntries([
  ...[1, 2, 3, 4].map((book) => [`nce-1997-b${book}`, 100]),
  ...[1, 2, 3, 4].map((stage) => [`ielts-nawl-v1-s${stage}`, 50]),
  ...[1, 2, 3, 4].map((stage) => [`kaoyan-core-v1-s${stage}`, 50])
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

if (!entries.includes(ASSESSMENT_ENTRY)) {
  fail(`embedded assessment bank is missing: ${ASSESSMENT_ENTRY}`);
}

let assessmentBank;
let expectedAssessmentBank;
try {
  assessmentBank = JSON.parse(
    execFileSync("unzip", ["-p", apkPath, ASSESSMENT_ENTRY], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    })
  );
  expectedAssessmentBank = JSON.parse(
    readFileSync(EXPECTED_ASSESSMENT_PATH, "utf8")
  );
} catch (error) {
  fail(`cannot read embedded assessment bank: ${error.message}`);
}

const assessmentItems = Array.isArray(assessmentBank.items)
  ? assessmentBank.items
  : [];
const realAssessmentItems = assessmentItems.filter(
  (item) => item.itemType === "realWord"
);
const pseudowordAssessmentItems = assessmentItems.filter(
  (item) => item.itemType === "pseudoword"
);
if (
  assessmentBank.schemaVersion !== 2 ||
  assessmentBank.policyVersion !== 2 ||
  typeof assessmentBank.bankVersion !== "string" ||
  !assessmentBank.bankVersion.startsWith("assessment-proxy-v2-") ||
  assessmentBank.bankVersion !== expectedAssessmentBank.bankVersion ||
  assessmentBank.sourceHash !== expectedAssessmentBank.sourceHash ||
  assessmentBank.calibrationStatus !== "proxy-v1" ||
  assessmentBank.estimateRange?.min !== 0 ||
  assessmentBank.estimateRange?.max !== 20000 ||
  assessmentBank.broadPhaseRules?.totalItems !== 20 ||
  assessmentBank.broadPhaseRules?.realItems !== 16 ||
  assessmentBank.broadPhaseRules?.pseudowordItems !== 4 ||
  assessmentBank.stoppingRules?.minimumScoringItems !== 48 ||
  assessmentBank.stoppingRules?.maximumScoringItems !== 76 ||
  assessmentBank.stoppingRules?.wrapUpItems !== 4 ||
  assessmentBank.stoppingRules?.minimumMultipleChoiceItems !== 12 ||
  assessmentBank.stoppingRules?.minimumBasicItems !== 4 ||
  assessmentBank.stoppingRules?.minimumAdvancedItems !== 4 ||
  assessmentBank.stoppingRules?.minimumTargetItems !== 4 ||
  assessmentBank.stoppingRules?.standardErrorThreshold !== 0.32 ||
  assessmentBank.stoppingRules?.relativeEstimateChangeThreshold !== 0.03 ||
  assessmentBank.stoppingRules?.stableEstimateChanges !== 6 ||
  assessmentBank.stoppingRules?.informationThreshold !== 0.08 ||
  assessmentItems.length !== 1440 ||
  realAssessmentItems.length !== 1200 ||
  pseudowordAssessmentItems.length !== 240 ||
  new Set(assessmentItems.map((item) => item.itemId)).size !== 1440 ||
  new Set(assessmentItems.map((item) => item.lemmaId)).size !== 1440 ||
  new Set(assessmentItems.map((item) => item.spelling)).size !== 1440
) {
  fail(
    `embedded assessment topology is invalid: version=${assessmentBank.bankVersion || "missing"}, ` +
      `items=${assessmentItems.length}, real=${realAssessmentItems.length}, ` +
      `pseudowords=${pseudowordAssessmentItems.length}`
  );
}

for (let band = 1; band <= 20; band += 1) {
  const realCount = realAssessmentItems.filter(
    (item) => item.frequencyBand === band
  ).length;
  const pseudowordCount = pseudowordAssessmentItems.filter(
    (item) => item.frequencyBand === band
  ).length;
  if (realCount !== 60 || pseudowordCount !== 12) {
    fail(
      `embedded assessment band ${band} is invalid: ` +
        `real=${realCount}, pseudowords=${pseudowordCount}`
    );
  }
}

for (const item of realAssessmentItems) {
  if (
    !Array.isArray(item.options) ||
    item.options.length !== 4 ||
    new Set(item.options).size !== 4 ||
    item.options[item.correctOptionIndex] !== item.meaning ||
    item.calibrationStatus !== "proxy-v1"
  ) {
    fail(`embedded assessment item ${item.itemId || "unknown"} is invalid`);
  }
}

console.log(
  `Android APK gate passed: ${apkSize} bytes; ABIs: ${REQUIRED_ABIS.join(", ")}; ` +
    `catalog ${catalog.contentVersion}: 400 NCE + 200 IELTS + 200 Kaoyan; ` +
    `assessment ${assessmentBank.bankVersion}: 1200 real + 240 pseudowords`
);
