const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const bankPath = path.join(
  root,
  'word_trail_flutter/assets/content/assessment/bank-v1.json',
);
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const parityPath = path.join(
  root,
  'word_trail_flutter/assets/content/assessment/policy-v2-parity-fixtures.json',
);
const parity = JSON.parse(fs.readFileSync(parityPath, 'utf8'));
const real = bank.items.filter((item) => item.itemType === 'realWord');
const pseudo = bank.items.filter((item) => item.itemType === 'pseudoword');
const failures = [];
const compiledAssessmentPath = path.join(
  root,
  '.content-dist/lib/web-assessment.js',
);
const createdCompiledAssessment = !fs.existsSync(compiledAssessmentPath);

if (createdCompiledAssessment) {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules/typescript/bin/tsc'),
      '-p',
      path.join(root, 'tsconfig.content.json'),
    ],
    { cwd: root, stdio: 'inherit' },
  );
}

function stableHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireGate(condition, message) {
  if (!condition) failures.push(message);
}

requireGate(bank.schemaVersion === 2, 'schemaVersion must be 2');
requireGate(bank.policyVersion === 2, 'policyVersion must be 2');
requireGate(
  typeof bank.bankVersion === 'string' &&
    bank.bankVersion.startsWith('assessment-proxy-v2-'),
  'bankVersion must identify proxy policy v2',
);
requireGate(bank.calibrationStatus === 'proxy-v1', 'bank must remain proxy-v1');
const expectedSourceHash = stableHash(JSON.stringify({
  generatorVersion: bank.generatorVersion,
  schemaVersion: bank.schemaVersion,
  policyVersion: bank.policyVersion,
  estimateRange: bank.estimateRange,
  calibrationStatus: bank.calibrationStatus,
  anchorProfiles: bank.anchorProfiles,
  broadPhaseRules: bank.broadPhaseRules,
  stoppingRules: bank.stoppingRules,
  items: bank.items,
}));
requireGate(
  bank.sourceHash === expectedSourceHash,
  'sourceHash must cover the complete model and item payload',
);
requireGate(
  bank.bankVersion === `assessment-proxy-v2-${expectedSourceHash.slice(0, 16)}`,
  'bankVersion must derive from the complete model hash',
);
requireGate(parity.schemaVersion === 1, 'parity fixture schemaVersion must be 1');
requireGate(parity.policyVersion === 2, 'parity fixture policyVersion must be 2');
requireGate(
  parity.bankVersion === bank.bankVersion,
  'parity fixtures must identify the generated bank version',
);
requireGate(
  Array.isArray(parity.cases) && parity.cases.length === 3,
  'parity fixtures must contain three deterministic conformance cases',
);
try {
  const { buildFixture } = require('./generate-assessment-parity-fixtures.cjs');
  requireGate(
    JSON.stringify(parity) === JSON.stringify(buildFixture(bank)),
    'parity fixtures must match deterministic policy execution',
  );
} catch (error) {
  requireGate(false, `parity execution failed: ${error.message}`);
}
requireGate(
  JSON.stringify(bank.broadPhaseRules) ===
    JSON.stringify({
      totalItems: 20,
      realItems: 16,
      pseudowordItems: 4,
      realBands: [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 20],
      pseudowordSlots: [3, 8, 13, 18],
      pseudowordBands: [4, 9, 14, 19],
    }),
  'broad-phase policy must be 20 items (16 real + 4 pseudowords)',
);
requireGate(
  JSON.stringify(bank.stoppingRules) ===
    JSON.stringify({
      minimumScoringItems: 48,
      maximumScoringItems: 76,
      wrapUpItems: 4,
      minimumMultipleChoiceItems: 12,
      minimumBasicItems: 4,
      minimumAdvancedItems: 4,
      minimumTargetItems: 4,
      standardErrorThreshold: 0.32,
      relativeEstimateChangeThreshold: 0.03,
      stableEstimateChanges: 6,
      informationThreshold: 0.08,
    }),
  'stopping policy must match assessment policy v2',
);
requireGate(real.length === 1200, `expected 1200 real items, got ${real.length}`);
requireGate(pseudo.length === 240, `expected 240 pseudowords, got ${pseudo.length}`);
requireGate(
  new Set(bank.items.map((item) => item.itemId)).size === 1440,
  'item IDs must be unique',
);
requireGate(
  new Set(bank.items.map((item) => item.spelling)).size === 1440,
  'all spellings must be unique',
);
const realSpellings = new Set(real.map((item) => item.spelling));
requireGate(
  pseudo.every((item) => !realSpellings.has(item.spelling)),
  'pseudowords must not overlap real lemmas',
);
for (let band = 1; band <= 20; band += 1) {
  requireGate(
    real.filter((item) => item.frequencyBand === band).length === 60,
    `band ${band} must contain 60 real items`,
  );
  requireGate(
    pseudo.filter((item) => item.frequencyBand === band).length === 12,
    `band ${band} must contain 12 pseudowords`,
  );
}
for (const item of real) {
  requireGate(item.options.length === 4, `${item.itemId} must have 4 options`);
  requireGate(
    new Set(item.options).size === 4,
    `${item.itemId} options must be unique`,
  );
  requireGate(
    item.options[item.correctOptionIndex] === item.meaning,
    `${item.itemId} has an invalid answer key`,
  );
  requireGate(
    item.calibrationStatus === 'proxy-v1',
    `${item.itemId} must remain proxy-v1`,
  );
}

if (createdCompiledAssessment) {
  fs.rmSync(path.join(root, '.content-dist'), { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      bankVersion: bank.bankVersion,
      schemaVersion: bank.schemaVersion,
      policyVersion: bank.policyVersion,
      calibrationStatus: bank.calibrationStatus,
      realItems: real.length,
      pseudowordItems: pseudo.length,
      frequencyBands: 20,
      realPerBand: 60,
      pseudowordsPerBand: 12,
      uniqueSpellings: new Set(bank.items.map((item) => item.spelling)).size,
      exactFourOptionItems: real.filter((item) => item.options.length === 4)
        .length,
      bytes: fs.statSync(bankPath).size,
    },
    null,
    2,
  ),
);
