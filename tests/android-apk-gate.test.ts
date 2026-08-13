import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";

const checker = resolve("scripts/check-android-apk.cjs");
const assessmentSource = resolve(
  "word_trail_flutter/assets/content/assessment/bank-v1.json"
);
let fixtureRoot = "";
let validApk = "";

function writeFixture(root: string, includeAssessment: boolean): void {
  const flutterAssets = join(root, "assets/flutter_assets/assets/content");
  const levelsDirectory = join(flutterAssets, "levels");
  mkdirSync(levelsDirectory, { recursive: true });

  const curricula = [
    { id: "nce-1997", trackPrefix: "nce-1997-b", tracks: 4, perTrack: 100 },
    {
      id: "ielts-nawl-v1",
      trackPrefix: "ielts-nawl-v1-s",
      tracks: 4,
      perTrack: 50,
    },
    {
      id: "kaoyan-core-v1",
      trackPrefix: "kaoyan-core-v1-s",
      tracks: 4,
      perTrack: 50,
    },
  ];
  const catalogCurricula: Array<{ id: string }> = [];
  const tracks: Array<{ id: string; levelIds: string[] }> = [];
  const levels: Array<{
    id: string;
    curriculumId: string;
    trackId: string;
    assetPath: string;
  }> = [];
  for (const curriculum of curricula) {
    catalogCurricula.push({ id: curriculum.id });
    let curriculumLevel = 0;
    for (let track = 1; track <= curriculum.tracks; track += 1) {
      const trackId = `${curriculum.trackPrefix}${track}`;
      const levelIds: string[] = [];
      for (let localLevel = 1; localLevel <= curriculum.perTrack; localLevel += 1) {
        curriculumLevel += 1;
        const suffix = String(
          curriculum.id === "nce-1997" ? localLevel : curriculumLevel
        ).padStart(3, "0");
        const levelId = `${trackId}-level-${suffix}`;
        const assetPath = `assets/content/levels/${levelId}.json`;
        levelIds.push(levelId);
        levels.push({ id: levelId, curriculumId: curriculum.id, trackId, assetPath });
        writeFileSync(join(levelsDirectory, `${levelId}.json`), "{}");
      }
      tracks.push({ id: trackId, levelIds });
    }
  }
  writeFileSync(
    join(flutterAssets, "catalog.json"),
    JSON.stringify({
      schemaVersion: 1,
      contentVersion: "word-trail-apk-gate-test",
      curricula: catalogCurricula,
      tracks,
      levels,
    })
  );

  if (includeAssessment) {
    const assessmentDirectory = join(flutterAssets, "assessment");
    mkdirSync(assessmentDirectory, { recursive: true });
    copyFileSync(assessmentSource, join(assessmentDirectory, "bank-v1.json"));
  }
  for (const abi of ["armeabi-v7a", "arm64-v8a"]) {
    const directory = join(root, "lib", abi);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "libapp.so"), "fixture");
    writeFileSync(join(directory, "libflutter.so"), "fixture");
  }
}

function zipFixture(root: string, apkPath: string): void {
  execFileSync("zip", ["-q", "-r", apkPath, "assets", "lib"], { cwd: root });
}

before(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "word-trail-apk-gate-"));
  const validRoot = join(fixtureRoot, "valid");
  mkdirSync(validRoot);
  writeFixture(validRoot, true);
  validApk = join(fixtureRoot, "valid.apk");
  zipFixture(validRoot, validApk);
});

after(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

test("APK gate accepts the complete catalog and assessment bank", () => {
  const result = spawnSync(process.execPath, [checker, validApk], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1200 real \+ 240 pseudowords/);
});

test("APK gate rejects an APK that omits the assessment bank", () => {
  const missingRoot = join(fixtureRoot, "missing-assessment");
  mkdirSync(missingRoot);
  writeFixture(missingRoot, false);
  const apkPath = join(fixtureRoot, "missing-assessment.apk");
  zipFixture(missingRoot, apkPath);

  const result = spawnSync(process.execPath, [checker, apkPath], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /embedded assessment bank is missing/);
});

test("APK gate rejects a malformed embedded assessment topology", () => {
  const invalidRoot = join(fixtureRoot, "invalid-assessment");
  mkdirSync(invalidRoot);
  writeFixture(invalidRoot, true);
  const bankPath = join(
    invalidRoot,
    "assets/flutter_assets/assets/content/assessment/bank-v1.json"
  );
  const bank = JSON.parse(readFileSync(bankPath, "utf8"));
  bank.items.pop();
  writeFileSync(bankPath, JSON.stringify(bank));
  const apkPath = join(fixtureRoot, "invalid-assessment.apk");
  zipFixture(invalidRoot, apkPath);

  const result = spawnSync(process.execPath, [checker, apkPath], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /embedded assessment topology is invalid/);
});
