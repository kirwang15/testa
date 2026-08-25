const { createHash } = require('crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..');
const {
  nextAssessmentQuestion,
  startAssessment,
  submitAssessmentAnswer,
} = require(resolve(root, '.content-dist/lib/web-assessment.js'));

const startedAt = '2026-08-13T00:00:00.000Z';
const definitions = [
  { id: 'unrestricted-all-correct', anchor: 'unrestricted', seed: 101, strategy: 'allCorrect' },
  { id: 'ielts-all-wrong', anchor: 'ielts', seed: 202, strategy: 'allWrong' },
  { id: 'primary-alternating', anchor: 'primarySchool', seed: 303, strategy: 'alternating' },
];

function generateCase(definition, bank) {
  let session = startAssessment(bank, definition.anchor, {
    seed: definition.seed,
    startedAt: new Date(startedAt),
  });
  const questionIds = [];
  while (session.phase !== 'complete') {
    const question = nextAssessmentQuestion(bank, session);
    questionIds.push(question.questionId);
    const ordinal = session.responses.length;
    const baseCorrect = definition.strategy === 'allCorrect'
      ? true
      : definition.strategy === 'allWrong'
        ? false
        : ordinal % 2 === 0;
    const correct = question.item.itemType === 'pseudoword'
      ? definition.strategy !== 'allWrong'
      : baseCorrect;
    session = submitAssessmentAnswer(bank, session, question, {
      recognized: question.type === 'yesNo'
        ? question.item.itemType === 'pseudoword' ? !correct : correct
        : undefined,
      selectedOptionIndex: question.type === 'multipleChoice'
        ? correct
          ? question.item.correctOptionIndex
          : (question.item.correctOptionIndex + 1) % question.item.options.length
        : undefined,
      responseTimeMs: 1200,
    }).session;
  }
  return {
    ...definition,
    expected: {
      questionSequenceSha256: createHash('sha256')
        .update(questionIds.join('\n'))
        .digest('hex'),
      totalScreens: session.responses.length,
      broadScreens: session.responses.filter((response) => response.phase === 'broad').length,
      adaptiveScreens: session.responses.filter((response) => response.phase === 'adaptive').length,
      wrapUpScreens: session.responses.filter((response) => response.phase === 'wrapUp').length,
      multipleChoiceScored: session.responses.filter(
        (response) => response.scored && response.questionType === 'multipleChoice',
      ).length,
      theta: Number(session.theta.toFixed(12)),
      standardError: Number(session.standardError.toFixed(12)),
      estimate: session.estimate,
      estimateLower: session.estimateLower,
      estimateUpper: session.estimateUpper,
      reliability: session.reliability,
      coverage: session.coverage,
    },
  };
}

function buildFixture(bank) {
  return {
    schemaVersion: 1,
    policyVersion: 2,
    bankVersion: bank.bankVersion,
    startedAt,
    cases: definitions.map((definition) => generateCase(definition, bank)),
  };
}

if (require.main === module) {
  const bank = JSON.parse(readFileSync(resolve(
    root,
    'word_trail_flutter/assets/content/assessment/bank-v1.json',
  ), 'utf8'));
  const fixture = buildFixture(bank);
  const output = resolve(
    root,
    'word_trail_flutter/assets/content/assessment/policy-v2-parity-fixtures.json',
  );
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, `${JSON.stringify(fixture)}\n`, 'utf8');
  console.log(`Generated ${fixture.cases.length} parity cases for ${bank.bankVersion}.`);
}

module.exports = { buildFixture };
