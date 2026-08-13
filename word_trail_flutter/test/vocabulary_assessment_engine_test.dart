import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/models/assessment.dart';
import 'package:word_trail_app/services/vocabulary_assessment_engine.dart';

void main() {
  late AssessmentBank bank;

  setUpAll(() {
    bank = AssessmentBank.decode(
      File('assets/content/assessment/bank-v1.json').readAsStringSync(),
    );
  });

  test('first phase is exactly eight real words and two pseudowords', () {
    final engine = VocabularyAssessmentEngine(bank: bank, seed: 7);
    var session = engine.start(AssessmentAnchor.unrestricted);
    final kinds = <AssessmentItemKind>[];

    for (var index = 0; index < 10; index += 1) {
      final question = engine.nextQuestion(session);
      expect(question.phase, AssessmentPhase.broad);
      expect(question.type, AssessmentQuestionType.yesNo);
      kinds.add(question.item.kind);
      session = engine
          .submit(
            session,
            question,
            AssessmentAnswer.yesNo(recognized: false, responseTimeMs: 2500),
          )
          .session;
    }

    expect(
      kinds.where((kind) => kind == AssessmentItemKind.realWord),
      hasLength(8),
    );
    expect(
      kinds.where((kind) => kind == AssessmentItemKind.pseudoword),
      hasLength(2),
    );
    expect(engine.nextQuestion(session).phase, AssessmentPhase.adaptive);
  });

  test(
    'adaptive run is bounded and finishes with two unscored wrap-up items',
    () {
      final engine = VocabularyAssessmentEngine(bank: bank, seed: 19);
      var session = engine.start(AssessmentAnchor.kaoyan);

      while (!session.isComplete) {
        final question = engine.nextQuestion(session);
        final answer = question.type == AssessmentQuestionType.multipleChoice
            ? AssessmentAnswer.multipleChoice(
                selectedOptionIndex: question.item.correctOptionIndex,
                responseTimeMs: 4200,
              )
            : AssessmentAnswer.yesNo(
                recognized: question.item.frequencyBand <= 7,
                responseTimeMs: 2100,
              );
        session = engine.submit(session, question, answer).session;
      }

      expect(session.responses.length, lessThanOrEqualTo(40));
      expect(session.scoredResponses.length, inInclusiveRange(24, 38));
      expect(session.wrapUpResponses, hasLength(2));
      expect(
        session.wrapUpResponses.every((response) => !response.scored),
        isTrue,
      );
      expect(session.multipleChoiceCount, greaterThanOrEqualTo(6));
      expect(session.estimate, inInclusiveRange(0, 20000));
      expect(session.estimateLower, lessThanOrEqualTo(session.estimate));
      expect(session.estimateUpper, greaterThanOrEqualTo(session.estimate));
      expect(session.coverageProfile['target'], greaterThan(0));
      expect(
        session.coverageProfile.values,
        everyElement(inInclusiveRange(0, 1)),
      );
    },
  );

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

  test('recognizing both phase-one pseudowords invalidates reliability', () {
    final engine = VocabularyAssessmentEngine(bank: bank, seed: 11);
    var session = engine.start(AssessmentAnchor.highSchool);

    for (var index = 0; index < 10; index += 1) {
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

    expect(session.pseudowordFalsePositives, 2);
    expect(session.reliability, AssessmentReliability.invalid);
  });

  test(
    'too many skipped items fail closed instead of publishing the prior',
    () {
      final engine = VocabularyAssessmentEngine(bank: bank, seed: 41);
      var session = engine.start(AssessmentAnchor.unrestricted);

      while (!session.isComplete) {
        final question = engine.nextQuestion(session);
        session = engine
            .submit(
              session,
              question,
              AssessmentAnswer.skipped(responseTimeMs: 30000),
            )
            .session;
      }

      expect(session.responses, hasLength(40));
      expect(session.scoredResponses, isEmpty);
      expect(session.reliability, AssessmentReliability.invalid);
    },
  );

  test('simulated estimates increase monotonically with ability', () {
    final estimates = <int>[];
    for (final knownThroughBand in [3, 7, 11, 15, 19]) {
      final engine = VocabularyAssessmentEngine(
        bank: bank,
        seed: 100 + knownThroughBand,
      );
      var session = engine.start(AssessmentAnchor.unrestricted);
      while (!session.isComplete) {
        final question = engine.nextQuestion(session);
        final correct = question.item.frequencyBand <= knownThroughBand;
        session = engine
            .submit(
              session,
              question,
              question.type == AssessmentQuestionType.multipleChoice
                  ? AssessmentAnswer.multipleChoice(
                      selectedOptionIndex: correct
                          ? question.item.correctOptionIndex
                          : (question.item.correctOptionIndex + 1) % 4,
                      responseTimeMs: 3000,
                    )
                  : AssessmentAnswer.yesNo(
                      recognized:
                          question.item.kind == AssessmentItemKind.realWord &&
                          correct,
                      responseTimeMs: 1800,
                    ),
            )
            .session;
      }
      estimates.add(session.estimate);
    }

    expect(estimates, orderedEquals([...estimates]..sort()));
    expect(estimates.toSet().length, estimates.length);
  });

  test(
    'proxy-model 95% intervals cover at least 90% across abilities and seeds',
    () {
      const abilityThetas = <double>[-3.7, -2.2, -1.1, 0, 1.1, 2.2, 3.7];
      const seedsPerAbility = 24;
      var covered = 0;
      var simulations = 0;

      for (var abilityIndex = 0;
          abilityIndex < abilityThetas.length;
          abilityIndex += 1) {
        final trueTheta = abilityThetas[abilityIndex];
        final trueEstimate = _estimateForTheta(trueTheta);
        for (var seed = 0; seed < seedsPerAbility; seed += 1) {
          final simulationSeed = 10000 + abilityIndex * 100 + seed;
          final random = math.Random(simulationSeed);
          final engine = VocabularyAssessmentEngine(
            bank: bank,
            seed: simulationSeed,
          );
          var session = engine.start(AssessmentAnchor.unrestricted);

          while (!session.isComplete) {
            final question = engine.nextQuestion(session);
            final answer = _simulatedAnswer(
              question: question,
              trueTheta: trueTheta,
              random: random,
            );
            session = engine.submit(session, question, answer).session;
          }

          simulations += 1;
          if (session.estimateLower <= trueEstimate &&
              trueEstimate <= session.estimateUpper) {
            covered += 1;
          }
        }
      }

      final coverage = covered / simulations;
      expect(
        coverage,
        greaterThanOrEqualTo(0.90),
        reason:
            'Proxy-model 95% interval covered $covered/$simulations '
            'simulations (${(coverage * 100).toStringAsFixed(1)}%).',
      );
    },
    timeout: const Timeout(Duration(minutes: 2)),
  );
}

AssessmentAnswer _simulatedAnswer({
  required AssessmentQuestion question,
  required double trueTheta,
  required math.Random random,
}) {
  if (question.item.kind == AssessmentItemKind.pseudoword) {
    return const AssessmentAnswer.yesNo(
      recognized: false,
      responseTimeMs: 1800,
    );
  }

  final logistic = 1 /
      (1 +
          math.exp(
            -question.item.discrimination *
                (trueTheta - question.item.difficulty),
          ));
  final guessing = question.type == AssessmentQuestionType.multipleChoice
      ? question.item.guessing
      : 0.0;
  final successProbability = guessing + (1 - guessing) * logistic;
  final successful = random.nextDouble() < successProbability;

  if (question.type == AssessmentQuestionType.yesNo) {
    return AssessmentAnswer.yesNo(
      recognized: successful,
      responseTimeMs: 1800,
    );
  }
  return AssessmentAnswer.multipleChoice(
    selectedOptionIndex: successful
        ? question.item.correctOptionIndex
        : (question.item.correctOptionIndex + 1) % question.item.options.length,
    responseTimeMs: 3000,
  );
}

int _estimateForTheta(double theta) {
  final raw = 20000 / (1 + math.exp(-theta));
  return ((raw / 100).round() * 100).clamp(0, 20000);
}
