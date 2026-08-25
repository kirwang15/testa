const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const levelsDirectory = path.join(
  root,
  'word_trail_flutter/assets/content/levels',
);
const outputDirectory = path.join(
  root,
  'word_trail_flutter/assets/content/assessment',
);
const outputPath = path.join(outputDirectory, 'bank-v1.json');
const generatorVersion = 'assessment-bank-generator-v2';
const broadPhaseRules = Object.freeze({
  totalItems: 20,
  realItems: 16,
  pseudowordItems: 4,
  realBands: [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 20],
  pseudowordSlots: [3, 8, 13, 18],
  pseudowordBands: [4, 9, 14, 19],
});
const stoppingRules = Object.freeze({
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
});

function normalizedPartOfSpeech(value) {
  const source = String(value || '').toLowerCase();
  if (source.includes('noun')) return 'noun';
  if (source.includes('verb')) return 'verb';
  if (source.includes('adj')) return 'adjective';
  if (source.includes('adv')) return 'adverb';
  return null;
}

function cefrOrder(value) {
  return { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }[value] || 7;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function thetaForEstimate(value) {
  const probability = Math.min(0.999, Math.max(0.001, value / 20000));
  return Number(Math.log(probability / (1 - probability)).toFixed(6));
}

function difficultyForBand(band) {
  return thetaForEstimate((band - 0.5) * 1000);
}

function collectWords() {
  const bySpelling = new Map();
  const files = fs
    .readdirSync(levelsDirectory)
    .filter((file) => file.endsWith('.json'))
    .sort();
  for (const file of files) {
    const bundle = JSON.parse(
      fs.readFileSync(path.join(levelsDirectory, file), 'utf8'),
    );
    const vocabularyById = new Map(
      (bundle.vocabulary || []).map((word) => [word.id, word]),
    );
    for (const target of bundle.level.targetWords || []) {
      const spelling = String(target.word || '').toLowerCase();
      const vocabulary = vocabularyById.get(target.id) || {};
      const partOfSpeech = normalizedPartOfSpeech(vocabulary.partOfSpeech);
      const meaning = String(target.chineseMeaning || '').trim();
      if (
        !/^[a-z]{3,10}$/.test(spelling) ||
        !partOfSpeech ||
        !meaning ||
        meaning.length > 80
      ) {
        continue;
      }
      const candidate = {
        spelling,
        lemmaId: `assessment-real-${spelling}`,
        meaning,
        partOfSpeech,
        cefr: vocabulary.cefrLevel || '',
        frequencyRank: Number.isFinite(vocabulary.frequencyRank)
          ? vocabulary.frequencyRank
          : null,
        curriculumId: bundle.level.curriculumId,
        sourceId: `${bundle.level.curriculumId}:${target.id}`,
      };
      const previous = bySpelling.get(spelling);
      const candidateQuality =
        (candidate.frequencyRank === null ? 0 : 2) +
        (candidate.curriculumId === 'ielts-nawl-v1' ? 1 : 0);
      const previousQuality = previous
        ? (previous.frequencyRank === null ? 0 : 2) +
          (previous.curriculumId === 'ielts-nawl-v1' ? 1 : 0)
        : -1;
      if (!previous || candidateQuality > previousQuality) {
        bySpelling.set(spelling, candidate);
      }
    }
  }
  const words = [...bySpelling.values()].sort((left, right) => {
    const cefrDifference = cefrOrder(left.cefr) - cefrOrder(right.cefr);
    if (cefrDifference !== 0) return cefrDifference;
    const leftRank = left.frequencyRank ?? 100000;
    const rightRank = right.frequencyRank ?? 100000;
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (left.spelling.length !== right.spelling.length) {
      return left.spelling.length - right.spelling.length;
    }
    return left.spelling.localeCompare(right.spelling);
  });
  if (words.length < 1200) {
    throw new Error(`Assessment needs 1200 eligible lemmas; found ${words.length}`);
  }
  return words.slice(0, 1200);
}

function buildOptions(word, bandWords, allWords) {
  const pool = allWords
    .filter(
      (candidate) =>
        candidate.spelling !== word.spelling &&
        candidate.partOfSpeech === word.partOfSpeech &&
        candidate.meaning !== word.meaning,
    )
    .sort((left, right) => {
      const leftBand = Math.floor(allWords.indexOf(left) / 60) + 1;
      const rightBand = Math.floor(allWords.indexOf(right) / 60) + 1;
      const distance =
        Math.abs(leftBand - bandWords.band) -
        Math.abs(rightBand - bandWords.band);
      if (distance !== 0) return distance;
      return stableHash(`${word.spelling}:${left.spelling}`).localeCompare(
        stableHash(`${word.spelling}:${right.spelling}`),
      );
    });
  const distractors = [];
  for (const candidate of pool) {
    if (!distractors.includes(candidate.meaning)) {
      distractors.push(candidate.meaning);
    }
    if (distractors.length === 3) break;
  }
  if (distractors.length !== 3) {
    throw new Error(`Not enough same-POS distractors for ${word.spelling}`);
  }
  const correctOptionIndex =
    parseInt(stableHash(word.spelling).slice(0, 8), 16) % 4;
  const options = [...distractors];
  options.splice(correctOptionIndex, 0, word.meaning);
  return { options, correctOptionIndex };
}

function loadDictionary(realSpellings) {
  const dictionary = new Set(realSpellings);
  for (const dictionaryPath of ['/usr/share/dict/words', '/usr/share/dict/web2']) {
    try {
      for (const line of fs.readFileSync(dictionaryPath, 'utf8').split(/\r?\n/)) {
        const word = line.trim().toLowerCase();
        if (/^[a-z]+$/.test(word)) dictionary.add(word);
      }
      break;
    } catch (_) {
      // The checked-in real-word set remains the mandatory portable gate.
    }
  }
  return dictionary;
}

function pseudowordFrom(base, salt, unavailable) {
  const onsets = [
    'b', 'br', 'cl', 'cr', 'd', 'dr', 'f', 'fl', 'fr', 'g', 'gl', 'gr',
    'k', 'kr', 'l', 'm', 'n', 'p', 'pl', 'pr', 'r', 's', 'sk', 'sl',
    'sm', 'sn', 'sp', 'st', 'sw', 't', 'tr', 'v', 'w', 'z',
  ];
  const nuclei = ['a', 'e', 'i', 'o', 'u', 'ae', 'ai', 'ea', 'oi', 'ou'];
  const codas = [
    'b', 'ck', 'd', 'f', 'g', 'l', 'm', 'n', 'nd', 'nt', 'p', 'r', 'rk',
    's', 'sh', 'st', 't', 'th', 'v', 'x', 'z',
  ];
  const suffixes = ['', '', '', 'en', 'er', 'ic', 'al', 'on', 'um', 'ish'];
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const hash = parseInt(
      stableHash(`${base}:${salt}:${attempt}`).slice(0, 12),
      16,
    );
    const onset = onsets[hash % onsets.length];
    const nucleus = nuclei[(hash >>> 5) % nuclei.length];
    const coda = codas[(hash >>> 9) % codas.length];
    const suffix = suffixes[(hash >>> 13) % suffixes.length];
    const candidate = `${onset}${nucleus}${coda}${suffix}`;
    if (
      Math.abs(candidate.length - base.length) <= 2 &&
      !unavailable.has(candidate) &&
      /^[a-z]{3,10}$/.test(candidate)
    ) {
      unavailable.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Could not create a dictionary-safe pseudoword for ${base}`);
}

function tagsForBand(band, curriculumId) {
  const tags = [
    band <= 7 ? 'basic' : band <= 14 ? 'advanced' : 'lowFrequency',
    curriculumId === 'ielts-nawl-v1' ? 'academic' : 'general',
  ];
  return tags;
}

const words = collectWords();
const realItems = words.map((word, index) => {
  const band = Math.floor(index / 60) + 1;
  const choices = buildOptions(word, { band }, words);
  return {
    itemId: `assessment-real-${String(index + 1).padStart(4, '0')}`,
    lemmaId: word.lemmaId,
    itemType: 'realWord',
    spelling: word.spelling,
    frequencyBand: band,
    targetTags: tagsForBand(band, word.curriculumId),
    meaning: word.meaning,
    partOfSpeech: word.partOfSpeech,
    options: choices.options,
    correctOptionIndex: choices.correctOptionIndex,
    difficulty: difficultyForBand(band),
    discrimination: 1,
    guessing: 0.25,
    calibrationStatus: 'proxy-v1',
    sourceId: word.sourceId,
  };
});

const unavailable = loadDictionary(words.map((word) => word.spelling));
const pseudowordItems = [];
for (let band = 1; band <= 20; band += 1) {
  const bandWords = words.slice((band - 1) * 60, band * 60);
  for (let offset = 0; offset < 12; offset += 1) {
    const base = bandWords[(offset * 5 + band) % bandWords.length];
    const spelling = pseudowordFrom(base.spelling, offset, unavailable);
    const ordinal = (band - 1) * 12 + offset + 1;
    pseudowordItems.push({
      itemId: `assessment-pseudo-${String(ordinal).padStart(3, '0')}`,
      lemmaId: `assessment-pseudo-lemma-${String(ordinal).padStart(3, '0')}`,
      itemType: 'pseudoword',
      spelling,
      frequencyBand: band,
      targetTags: tagsForBand(band, base.curriculumId),
      meaning: '',
      partOfSpeech: '',
      options: [],
      correctOptionIndex: -1,
      difficulty: difficultyForBand(band),
      discrimination: 1,
      guessing: 0,
      calibrationStatus: 'proxy-v1',
      sourceId: `generated-pseudoword:${base.sourceId}`,
    });
  }
}

const anchors = [
  ['primarySchool', 1000, 2000, 0.9],
  ['middleSchool', 2000, 4000, 1],
  ['highSchool', 3000, 6000, 1.05],
  ['kaoyan', 4000, 8000, 1.1],
  ['ielts', 5000, 10000, 1.1],
  ['toefl', 6000, 12000, 1.15],
  ['unrestricted', 0, 20000, 2],
].map(([id, estimateMin, estimateMax, priorStandardDeviation]) => ({
  id,
  estimateMin,
  estimateMax,
  priorMeanTheta: thetaForEstimate((estimateMin + estimateMax) / 2),
  priorStandardDeviation,
}));

// The bank identity covers every input that can affect item selection,
// scoring, interpretation or attribution. Hashing only spellings would allow
// a changed option key or IRT parameter to masquerade as the same bank.
const modelSnapshot = JSON.stringify({
  generatorVersion,
  schemaVersion: 2,
  policyVersion: 2,
  estimateRange: { min: 0, max: 20000 },
  calibrationStatus: 'proxy-v1',
  anchorProfiles: anchors,
  broadPhaseRules,
  stoppingRules,
  items: [...realItems, ...pseudowordItems],
});
const sourceHash = stableHash(modelSnapshot);

const bank = {
  schemaVersion: 2,
  policyVersion: 2,
  bankVersion: `assessment-proxy-v2-${sourceHash.slice(0, 16)}`,
  estimateRange: { min: 0, max: 20000 },
  calibrationStatus: 'proxy-v1',
  generatorVersion,
  sourceHash,
  anchorProfiles: anchors,
  broadPhaseRules,
  stoppingRules,
  items: [...realItems, ...pseudowordItems],
};

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(bank)}\n`);
console.log(
  JSON.stringify(
    {
      outputPath: path.relative(root, outputPath),
      bankVersion: bank.bankVersion,
      realItems: realItems.length,
      pseudowordItems: pseudowordItems.length,
      bands: 20,
      sourceHash,
      bytes: fs.statSync(outputPath).size,
    },
    null,
    2,
  ),
);
