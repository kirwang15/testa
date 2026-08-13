const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bankPath = path.join(
  root,
  'word_trail_flutter/assets/content/assessment/bank-v1.json',
);
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const real = bank.items.filter((item) => item.itemType === 'realWord');
const pseudo = bank.items.filter((item) => item.itemType === 'pseudoword');
const failures = [];

function requireGate(condition, message) {
  if (!condition) failures.push(message);
}

requireGate(bank.schemaVersion === 1, 'schemaVersion must be 1');
requireGate(bank.calibrationStatus === 'proxy-v1', 'bank must remain proxy-v1');
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

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      bankVersion: bank.bankVersion,
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
