import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/models/assessment.dart';
import 'package:word_trail_app/services/vocabulary_assessment_engine.dart';

const _trustedV1Provenance = <String, Object>{
  'sourceCommit': 'c57c1551e1d8171464754d1aefcb538411b35fdc',
  'bankVersion': 'assessment-proxy-v1-590f3d39e0828781',
  'bankSha256':
      'b6461d92cfb265aa0f5e9515466028d8d043b7cd7854cfaa3dfa93e0489cd079',
  'engineSha256':
      'f6a6aa62b86f9ed9007dfdad8f126b96f461193410363c688719e43373c03f1f',
  'seedsPerAbility': 100,
  'seedFormula': 'seed + ability * 1000',
  'responseGenerator':
      'dart:math Random(seed), one nextDouble per item, '
      '1PL/4PL proxy probability',
  'medianStandardError': 0.435902281548,
};

void main() {
  late AssessmentBank bank;

  setUpAll(() {
    bank = AssessmentBank.decode(
      File('assets/content/assessment/bank-v1.json').readAsStringSync(),
    );
  });

  test('broad phase is exactly 16 real words and four pseudowords', () {
    final engine = VocabularyAssessmentEngine(bank: bank, seed: 7);
    var session = engine.start(AssessmentAnchor.unrestricted);
    final questions = <AssessmentQuestion>[];

    for (var index = 0; index < 20; index += 1) {
      final question = engine.nextQuestion(session);
      questions.add(question);
      expect(question.phase, AssessmentPhase.broad);
      expect(question.type, AssessmentQuestionType.yesNo);
      session = engine
          .submit(
            session,
            question,
            AssessmentAnswer.yesNo(
              recognized: question.item.kind == AssessmentItemKind.realWord,
              responseTimeMs: 2500,
            ),
          )
          .session;
    }

    expect(
      questions.where(
        (question) => question.item.kind == AssessmentItemKind.realWord,
      ),
      hasLength(16),
    );
    expect(
      questions.where(
        (question) => question.item.kind == AssessmentItemKind.pseudoword,
      ),
      hasLength(4),
    );
    expect(
      questions
          .where(
            (question) => question.item.kind == AssessmentItemKind.pseudoword,
          )
          .map((question) => question.item.frequencyBand),
      orderedEquals(bank.broadPhaseRules.pseudowordBands),
    );
    expect(engine.nextQuestion(session).phase, AssessmentPhase.adaptive);
  });

  test('adaptive run obeys all policy-v2 bounds and quotas', () {
    final result = _finish(
      bank,
      anchor: AssessmentAnchor.unrestricted,
      seed: 19,
      strategy: _AnswerStrategy.allCorrect,
    );
    final scoredReal = result.scoredResponses.where(
      (response) => response.itemKind == AssessmentItemKind.realWord,
    );

    expect(result.responses.length, inInclusiveRange(52, 80));
    expect(result.scoringStageResponses.length, inInclusiveRange(48, 76));
    expect(result.wrapUpResponses, hasLength(4));
    expect(
      result.wrapUpResponses.every((response) => !response.scored),
      isTrue,
    );
    expect(result.multipleChoiceCount, greaterThanOrEqualTo(12));
    expect(
      scoredReal.where((response) => response.frequencyBand <= 7).length,
      greaterThanOrEqualTo(4),
    );
    expect(
      scoredReal
          .where(
            (response) =>
                response.frequencyBand >= 8 && response.frequencyBand <= 14,
          )
          .length,
      greaterThanOrEqualTo(4),
    );
    expect(
      scoredReal.where((response) => response.frequencyBand >= 15).length,
      greaterThanOrEqualTo(4),
    );
    expect(result.estimate, inInclusiveRange(0, 20000));
    expect(result.estimateLower, lessThanOrEqualTo(result.estimate));
    expect(result.estimateUpper, greaterThanOrEqualTo(result.estimate));
  });

  test('matches the shared policy-v2 Web/Flutter conformance fixtures', () {
    final fixture =
        jsonDecode(
              File(
                'assets/content/assessment/policy-v2-parity-fixtures.json',
              ).readAsStringSync(),
            )
            as Map<String, dynamic>;
    expect(fixture['policyVersion'], 2);
    expect(fixture['bankVersion'], bank.bankVersion);
    final startedAt = DateTime.parse(fixture['startedAt'] as String);

    for (final rawCase in fixture['cases'] as List<dynamic>) {
      final testCase = rawCase as Map<String, dynamic>;
      final expected = testCase['expected'] as Map<String, dynamic>;
      final anchor = AssessmentAnchor.values.byName(
        testCase['anchor'] as String,
      );
      final strategy = switch (testCase['strategy']) {
        'allCorrect' => _AnswerStrategy.allCorrect,
        'allWrong' => _AnswerStrategy.allWrong,
        'alternating' => _AnswerStrategy.alternating,
        final value => throw StateError('Unknown parity strategy: $value'),
      };
      final engine = VocabularyAssessmentEngine(
        bank: bank,
        seed: (testCase['seed'] as num).toInt(),
      );
      var session = engine.start(anchor, startedAt: startedAt);
      final questionIds = <String>[];
      while (!session.isComplete) {
        final question = engine.nextQuestion(session);
        questionIds.add(question.questionId);
        final correct = _isCorrectForStrategy(
          strategy,
          question,
          session.responses.length,
        );
        session = engine
            .submit(session, question, _answerFor(question, correct))
            .session;
      }

      final counts = <AssessmentPhase, int>{
        for (final phase in AssessmentPhase.values)
          phase: session.responses
              .where((response) => response.phase == phase)
              .length,
      };
      expect(
        sha256.convert(utf8.encode(questionIds.join('\n'))).toString(),
        expected['questionSequenceSha256'],
        reason: testCase['id'] as String,
      );
      expect(session.responses.length, expected['totalScreens']);
      expect(counts[AssessmentPhase.broad], expected['broadScreens']);
      expect(counts[AssessmentPhase.adaptive], expected['adaptiveScreens']);
      expect(counts[AssessmentPhase.wrapUp], expected['wrapUpScreens']);
      expect(session.multipleChoiceCount, expected['multipleChoiceScored']);
      expect(
        double.parse(session.theta.toStringAsFixed(12)),
        expected['theta'],
      );
      expect(
        double.parse(session.standardError.toStringAsFixed(12)),
        expected['standardError'],
      );
      expect(session.estimate, expected['estimate']);
      expect(session.estimateLower, expected['estimateLower']);
      expect(session.estimateUpper, expected['estimateUpper']);
      expect(session.reliability.name, expected['reliability']);
      final expectedCoverage = expected['coverage'] as Map<String, dynamic>;
      for (final key in const ['basic', 'advanced', 'target']) {
        expect(
          session.coverageProfile[key],
          closeTo((expectedCoverage[key] as num).toDouble(), 1e-15),
        );
      }
    }
  });

  test('three rapid answers are excluded and invalidate the run', () {
    final engine = VocabularyAssessmentEngine(bank: bank, seed: 2);
    var session = engine.start(AssessmentAnchor.unrestricted);
    AssessmentStep? lastStep;

    for (var index = 0; index < 3; index += 1) {
      final question = engine.nextQuestion(session);
      lastStep = engine.submit(
        session,
        question,
        AssessmentAnswer.yesNo(recognized: true, responseTimeMs: 200),
      );
      session = lastStep.session;
    }

    expect(lastStep!.showCarefulAnswerWarning, isTrue);
    expect(lastStep.lockInputFor, const Duration(seconds: 2));
    expect(session.responses.every((response) => !response.scored), isTrue);
    expect(session.reliability, AssessmentReliability.invalid);
  });

  test('recognizing all four broad pseudowords invalidates reliability', () {
    final engine = VocabularyAssessmentEngine(bank: bank, seed: 11);
    var session = engine.start(AssessmentAnchor.highSchool);

    for (var index = 0; index < 20; index += 1) {
      final question = engine.nextQuestion(session);
      session = engine
          .submit(
            session,
            question,
            AssessmentAnswer.yesNo(
              recognized: question.item.kind == AssessmentItemKind.pseudoword,
              responseTimeMs: 1600,
            ),
          )
          .session;
    }

    expect(session.pseudowordFalsePositives, 4);
    expect(session.reliability, AssessmentReliability.invalid);
  });

  test('too many skipped items fail closed at 80 screens', () {
    final engine = VocabularyAssessmentEngine(bank: bank, seed: 41);
    var session = engine.start(AssessmentAnchor.unrestricted);
    while (!session.isComplete) {
      final question = engine.nextQuestion(session);
      session = engine
          .submit(
            session,
            question,
            const AssessmentAnswer.skipped(responseTimeMs: 30000),
          )
          .session;
    }

    expect(session.responses, hasLength(80));
    expect(session.scoredResponses, isEmpty);
    expect(session.reliability, AssessmentReliability.invalid);
  });

  test(
    '11 abilities by 100 seeds pass monotonicity and 90% interval coverage',
    () {
      final abilities = List<int>.generate(11, (index) => 1000 + index * 1800);
      final frozenV1 =
          jsonDecode(
                File(
                  'test/fixtures/assessment-v1-baseline.json',
                ).readAsStringSync(),
              )
              as Map<String, dynamic>;
      for (final entry in _trustedV1Provenance.entries) {
        expect(
          frozenV1[entry.key],
          entry.value,
          reason:
              'The frozen v1 ${entry.key} is trusted test provenance, not '
              'a value that may drift with the policy-v2 implementation.',
        );
      }
      expect(
        (frozenV1['sourceCommit'] as String).startsWith('c57c155'),
        isTrue,
      );
      expect(frozenV1['abilities'], abilities);
      final medians = <double>[];
      final finalErrors = <double>[];
      var covered = 0;
      var total = 0;

      for (final ability in abilities) {
        final estimates = <int>[];
        for (var seed = 0; seed < 100; seed += 1) {
          final result = _simulate(bank, ability, seed + ability * 1000);
          estimates.add(result.estimate);
          finalErrors.add(result.standardError);
          if (result.estimateLower <= ability &&
              ability <= result.estimateUpper) {
            covered += 1;
          }
          total += 1;
        }
        medians.add(_median(estimates));
      }

      for (var index = 1; index < medians.length; index += 1) {
        expect(
          medians[index],
          greaterThan(medians[index - 1]),
          reason: 'Median estimates must rise: $medians',
        );
      }
      expect(
        covered / total,
        greaterThanOrEqualTo(0.90),
        reason: '95% interval coverage was $covered/$total',
      );
      expect(
        _median(finalErrors),
        lessThanOrEqualTo(bank.stoppingRules.standardErrorThreshold),
      );
      final v1Median = (frozenV1['medianStandardError'] as num).toDouble();
      final v2Median = _median(finalErrors);
      expect(
        v2Median,
        lessThanOrEqualTo(v1Median * 0.85),
        reason:
            'Frozen v1 median SE=$v1Median, policy-v2 median SE=$v2Median; '
            'expected at least 15% improvement.',
      );
    },
    timeout: const Timeout(Duration(minutes: 3)),
  );
}

enum _AnswerStrategy { allCorrect, allWrong, alternating }

bool _isCorrectForStrategy(
  _AnswerStrategy strategy,
  AssessmentQuestion question,
  int ordinal,
) {
  if (question.item.kind == AssessmentItemKind.pseudoword) {
    return strategy != _AnswerStrategy.allWrong;
  }
  return switch (strategy) {
    _AnswerStrategy.allCorrect => true,
    _AnswerStrategy.allWrong => false,
    _AnswerStrategy.alternating => ordinal.isEven,
  };
}

AssessmentAnswer _answerFor(AssessmentQuestion question, bool correct) {
  if (question.type == AssessmentQuestionType.yesNo) {
    return AssessmentAnswer.yesNo(
      recognized: question.item.kind == AssessmentItemKind.pseudoword
          ? !correct
          : correct,
      responseTimeMs: 1200,
    );
  }
  return AssessmentAnswer.multipleChoice(
    selectedOptionIndex: correct
        ? question.item.correctOptionIndex
        : (question.item.correctOptionIndex + 1) % question.item.options.length,
    responseTimeMs: 1200,
  );
}

AssessmentSession _finish(
  AssessmentBank bank, {
  required AssessmentAnchor anchor,
  required int seed,
  required _AnswerStrategy strategy,
}) {
  final engine = VocabularyAssessmentEngine(bank: bank, seed: seed);
  var session = engine.start(anchor);
  while (!session.isComplete) {
    final question = engine.nextQuestion(session);
    final correct = _isCorrectForStrategy(
      strategy,
      question,
      session.responses.length,
    );
    session = engine
        .submit(session, question, _answerFor(question, correct))
        .session;
    expect(session.responses.length, lessThanOrEqualTo(80));
  }
  return session;
}

AssessmentSession _simulate(AssessmentBank bank, int trueEstimate, int seed) {
  final theta = _thetaForEstimate(trueEstimate);
  final random = math.Random(seed);
  final engine = VocabularyAssessmentEngine(bank: bank, seed: seed);
  var session = engine.start(AssessmentAnchor.unrestricted);
  while (!session.isComplete) {
    final question = engine.nextQuestion(session);
    final guessing = question.type == AssessmentQuestionType.multipleChoice
        ? question.item.guessing
        : 0.0;
    final logistic =
        1 /
        (1 +
            math.exp(
              -question.item.discrimination *
                  (theta - question.item.difficulty),
            ));
    final probability = question.item.kind == AssessmentItemKind.pseudoword
        ? 1.0
        : guessing + (1 - guessing) * logistic;
    final correct = random.nextDouble() < probability;
    session = engine
        .submit(session, question, _answerFor(question, correct))
        .session;
    expect(session.responses.length, lessThanOrEqualTo(80));
  }
  return session;
}

double _thetaForEstimate(int estimate) {
  final probability = (estimate / 20000).clamp(0.001, 0.999);
  return math.log(probability / (1 - probability));
}

double _median(List<num> values) {
  final sorted = values.map((value) => value.toDouble()).toList()..sort();
  final middle = sorted.length ~/ 2;
  return sorted.length.isEven
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
}
