import 'dart:math' as math;

import '../models/assessment.dart';

/// Deterministic, offline adaptive vocabulary estimator.
///
/// The item parameters in the bundled bank are proxy values rather than
/// empirically calibrated measurements. The engine therefore keeps the
/// reliability label separate from the estimate and never upgrades the bank's
/// `proxy-v1` calibration status.
class VocabularyAssessmentEngine {
  VocabularyAssessmentEngine({
    required this.bank,
    this.seed = 0,
    Set<String> previouslyExposedLemmaIds = const <String>{},
  }) : previouslyExposedLemmaIds = Set.unmodifiable(previouslyExposedLemmaIds),
       _itemsById = Map.unmodifiable({
         for (final item in bank.items) item.itemId: item,
       });

  final AssessmentBank bank;
  final int seed;
  final Set<String> previouslyExposedLemmaIds;
  final Map<String, AssessmentItem> _itemsById;

  static const _broadRealBands = <int>[1, 4, 7, 10, 13, 16, 18, 20];
  static const _broadPseudowordSlots = <int>{3, 8};
  static const _thetaMinimum = -6.0;
  static const _thetaMaximum = 6.0;
  static const _thetaStep = 0.1;
  static const _rapidAnswerThresholdMs = 500;

  AssessmentSession start(AssessmentAnchor anchor, {DateTime? startedAt}) {
    final profile = bank.profile(anchor);
    final initialEstimate = _estimateForTheta(profile.priorMeanTheta);
    final bounds = _confidenceBounds(
      profile.priorMeanTheta,
      profile.priorStandardDeviation,
    );
    return AssessmentSession(
      selectedAnchor: anchor,
      bankVersion: bank.bankVersion,
      phase: AssessmentPhase.broad,
      responses: const <AssessmentResponse>[],
      usedItemIds: const <String>{},
      theta: profile.priorMeanTheta,
      standardError: profile.priorStandardDeviation,
      estimate: initialEstimate,
      estimateLower: bounds.$1,
      estimateUpper: bounds.$2,
      reliability: AssessmentReliability.good,
      estimateHistory: <int>[initialEstimate],
      startedAt: startedAt ?? DateTime.now(),
      durationMs: 0,
    );
  }

  AssessmentQuestion nextQuestion(AssessmentSession session) {
    _validateSession(session);
    if (session.isComplete) {
      throw StateError('A completed assessment has no next question');
    }

    return switch (session.phase) {
      AssessmentPhase.broad => _broadQuestion(session),
      AssessmentPhase.adaptive => _adaptiveQuestion(session),
      AssessmentPhase.wrapUp => _wrapUpQuestion(session),
      AssessmentPhase.complete => throw StateError(
        'A completed assessment has no next question',
      ),
    };
  }

  AssessmentStep submit(
    AssessmentSession session,
    AssessmentQuestion question,
    AssessmentAnswer answer,
  ) {
    _validateSession(session);
    if (session.isComplete || question.phase != session.phase) {
      throw StateError('Question does not belong to the active phase');
    }
    final expectedQuestion = nextQuestion(session);
    if (expectedQuestion.questionId != question.questionId) {
      throw StateError('Question does not match the current assessment state');
    }
    _validateAnswer(question, answer);

    final response = AssessmentResponse(
      questionId: question.questionId,
      itemId: question.item.itemId,
      lemmaId: question.item.lemmaId,
      itemKind: question.item.kind,
      frequencyBand: question.item.frequencyBand,
      targetTags: question.item.targetTags,
      questionType: question.type,
      phase: question.phase,
      recognized: answer.recognized,
      selectedOptionIndex: answer.selectedOptionIndex,
      correctOptionIndex: question.item.correctOptionIndex,
      skipped: answer.skipped,
      responseTimeMs: answer.responseTimeMs,
      lowEffort: false,
      scored: question.phase != AssessmentPhase.wrapUp && !answer.skipped,
      previouslyExposed: question.previouslyExposed,
      verifiesResponseIndex: question.verifiesResponseIndex,
    );

    var responses = <AssessmentResponse>[...session.responses, response];
    final rapidStreak = _trailingRapidAnswerCount(responses);
    final showWarning = rapidStreak == 3;
    if (rapidStreak >= 3) {
      final firstRapidIndex = responses.length - rapidStreak;
      responses = <AssessmentResponse>[
        for (var index = 0; index < responses.length; index += 1)
          if (index >= firstRapidIndex)
            _withScoringFlags(responses[index], lowEffort: true, scored: false)
          else
            responses[index],
      ];
    }

    final posterior = _posterior(responses, session.selectedAnchor);
    final reliability = _reliabilityFor(responses);
    final estimateHistory = <int>[...session.estimateHistory];
    if (response.phase != AssessmentPhase.wrapUp &&
        response.itemKind == AssessmentItemKind.realWord &&
        !answer.skipped &&
        !responses.last.lowEffort) {
      estimateHistory.add(posterior.estimate);
    }

    var nextPhase = session.phase;
    final scoringStageCount = responses
        .where((item) => item.phase != AssessmentPhase.wrapUp)
        .length;
    if (session.phase == AssessmentPhase.broad && scoringStageCount >= 10) {
      nextPhase = AssessmentPhase.adaptive;
    } else if (session.phase == AssessmentPhase.adaptive) {
      final provisional = _sessionFrom(
        previous: session,
        phase: AssessmentPhase.adaptive,
        responses: responses,
        posterior: posterior,
        reliability: reliability,
        estimateHistory: estimateHistory,
        responseTimeMs: answer.responseTimeMs,
      );
      if (_shouldStop(provisional)) {
        nextPhase = AssessmentPhase.wrapUp;
      }
    } else if (session.phase == AssessmentPhase.wrapUp) {
      final wrapUpCount = responses
          .where((item) => item.phase == AssessmentPhase.wrapUp)
          .length;
      if (wrapUpCount >= bank.stoppingRules.wrapUpItems) {
        nextPhase = AssessmentPhase.complete;
      }
    }

    final nextSession = _sessionFrom(
      previous: session,
      phase: nextPhase,
      responses: responses,
      posterior: posterior,
      reliability: reliability,
      estimateHistory: estimateHistory,
      responseTimeMs: answer.responseTimeMs,
    );
    return AssessmentStep(
      session: nextSession,
      showCarefulAnswerWarning: showWarning,
      lockInputFor: showWarning ? const Duration(seconds: 2) : Duration.zero,
    );
  }

  AssessmentQuestion _broadQuestion(AssessmentSession session) {
    final slot = session.scoringStageResponses.length;
    if (slot < 0 || slot >= 10) {
      throw StateError('Broad phase must contain exactly ten questions');
    }
    final isPseudoword = _broadPseudowordSlots.contains(slot);
    final realOrdinal =
        slot -
        _broadPseudowordSlots.where((pseudoSlot) => pseudoSlot < slot).length;
    final band = isPseudoword
        ? (slot == 3 ? 8 : 18)
        : _broadRealBands[realOrdinal];
    final item = _pickItem(
      kind: isPseudoword
          ? AssessmentItemKind.pseudoword
          : AssessmentItemKind.realWord,
      preferredBand: band,
      usedItemIds: session.usedItemIds,
      salt: slot,
    );
    return _question(
      session: session,
      item: item,
      type: AssessmentQuestionType.yesNo,
      phase: AssessmentPhase.broad,
    );
  }

  AssessmentQuestion _adaptiveQuestion(AssessmentSession session) {
    final adaptiveIndex = session.scoringStageResponses.length - 10;
    final type = adaptiveIndex.isEven
        ? AssessmentQuestionType.multipleChoice
        : AssessmentQuestionType.yesNo;

    if (type == AssessmentQuestionType.multipleChoice) {
      final verification = _verificationCandidate(session);
      if (verification != null) {
        return _question(
          session: session,
          item: verification.$2,
          type: type,
          phase: AssessmentPhase.adaptive,
          verifiesResponseIndex: verification.$1,
        );
      }
    }

    final forcedBand = switch (adaptiveIndex) {
      0 => 5,
      1 => 11,
      2 => _targetBand(session.selectedAnchor),
      _ => null,
    };
    final preferredBand = forcedBand ?? _bandForEstimate(session.estimate);
    final needsTargetItem = _targetResponseCount(session) < 2;
    final item = _pickItem(
      kind: AssessmentItemKind.realWord,
      preferredBand: preferredBand,
      usedItemIds: session.usedItemIds,
      salt: 100 + adaptiveIndex,
      predicate: needsTargetItem
          ? (candidate) => _matchesTarget(
              candidate.frequencyBand,
              candidate.targetTags,
              session.selectedAnchor,
            )
          : null,
    );
    return _question(
      session: session,
      item: item,
      type: type,
      phase: AssessmentPhase.adaptive,
    );
  }

  AssessmentQuestion _wrapUpQuestion(AssessmentSession session) {
    final wrapUpIndex = session.wrapUpResponses.length;
    final preferredBand = (session.estimate / 1000).round() - 3;
    final item = _pickItem(
      kind: AssessmentItemKind.realWord,
      preferredBand: preferredBand.clamp(1, 20),
      usedItemIds: session.usedItemIds,
      salt: 500 + wrapUpIndex,
    );
    return _question(
      session: session,
      item: item,
      type: AssessmentQuestionType.yesNo,
      phase: AssessmentPhase.wrapUp,
    );
  }

  AssessmentQuestion _question({
    required AssessmentSession session,
    required AssessmentItem item,
    required AssessmentQuestionType type,
    required AssessmentPhase phase,
    int? verifiesResponseIndex,
  }) {
    final ordinal = session.responses.length + 1;
    return AssessmentQuestion(
      questionId: 'assessment-question-$ordinal-${item.itemId}-${type.name}',
      item: item,
      type: type,
      phase: phase,
      previouslyExposed: previouslyExposedLemmaIds.contains(item.lemmaId),
      verifiesResponseIndex: verifiesResponseIndex,
    );
  }

  (int, AssessmentItem)? _verificationCandidate(AssessmentSession session) {
    final verifiedIndexes = session.responses
        .map((response) => response.verifiesResponseIndex)
        .whereType<int>()
        .toSet();
    for (var index = session.responses.length - 1; index >= 0; index -= 1) {
      final response = session.responses[index];
      if (!verifiedIndexes.contains(index) &&
          response.scored &&
          response.itemKind == AssessmentItemKind.realWord &&
          response.questionType == AssessmentQuestionType.yesNo &&
          response.recognized == true) {
        final item = _itemsById[response.itemId]!;
        return (index, item);
      }
    }
    return null;
  }

  AssessmentItem _pickItem({
    required AssessmentItemKind kind,
    required int preferredBand,
    required Set<String> usedItemIds,
    required int salt,
    bool Function(AssessmentItem item)? predicate,
  }) {
    final source = kind == AssessmentItemKind.realWord
        ? bank.realItems
        : bank.pseudowordItems;
    for (var distance = 0; distance < 20; distance += 1) {
      final bands = <int>{
        preferredBand - distance,
        preferredBand + distance,
      }.where((band) => band >= 1 && band <= 20).toSet();
      final candidates = source
          .where(
            (item) =>
                bands.contains(item.frequencyBand) &&
                !usedItemIds.contains(item.itemId) &&
                (predicate == null || predicate(item)),
          )
          .toList();
      if (candidates.isNotEmpty) {
        candidates.sort(
          (left, right) => _stableScore(
            left.itemId,
            salt,
          ).compareTo(_stableScore(right.itemId, salt)),
        );
        return candidates.first;
      }
    }
    if (predicate != null) {
      return _pickItem(
        kind: kind,
        preferredBand: preferredBand,
        usedItemIds: usedItemIds,
        salt: salt,
      );
    }
    throw StateError('Assessment bank has no unused ${kind.name} item');
  }

  int _stableScore(String value, int salt) {
    var hash = (0x811c9dc5 ^ seed ^ salt) & 0x7fffffff;
    for (final unit in value.codeUnits) {
      hash = ((hash ^ unit) * 0x01000193) & 0x7fffffff;
    }
    return hash;
  }

  _Posterior _posterior(
    List<AssessmentResponse> responses,
    AssessmentAnchor anchor,
  ) {
    final profile = bank.profile(anchor);
    final points = <(double, double)>[];
    var maximumLogWeight = double.negativeInfinity;

    for (
      var theta = _thetaMinimum;
      theta <= _thetaMaximum + 0.0001;
      theta += _thetaStep
    ) {
      var logWeight =
          -0.5 *
          math.pow(
            (theta - profile.priorMeanTheta) / profile.priorStandardDeviation,
            2,
          );
      for (final response in responses) {
        if (!response.scored ||
            response.skipped ||
            response.lowEffort ||
            response.itemKind == AssessmentItemKind.pseudoword ||
            response.phase == AssessmentPhase.wrapUp) {
          continue;
        }
        final item = _itemsById[response.itemId]!;
        final guessing =
            response.questionType == AssessmentQuestionType.multipleChoice
            ? item.guessing
            : 0.0;
        final probability = _successProbability(
          theta,
          item,
          guessing,
        ).clamp(1e-9, 1 - 1e-9);
        final likelihood = response.isCorrect ? probability : 1 - probability;
        final exposureWeight = response.previouslyExposed ? 0.5 : 1.0;
        logWeight += exposureWeight * math.log(likelihood);
      }
      points.add((theta, logWeight));
      maximumLogWeight = math.max(maximumLogWeight, logWeight);
    }

    var totalWeight = 0.0;
    var thetaSum = 0.0;
    for (final point in points) {
      final weight = math.exp(point.$2 - maximumLogWeight);
      totalWeight += weight;
      thetaSum += point.$1 * weight;
    }
    final meanTheta = thetaSum / totalWeight;
    var varianceSum = 0.0;
    for (final point in points) {
      final weight = math.exp(point.$2 - maximumLogWeight);
      varianceSum += math.pow(point.$1 - meanTheta, 2) * weight;
    }
    final standardError = math.sqrt(varianceSum / totalWeight);
    final estimate = _estimateForTheta(meanTheta);
    final bounds = _confidenceBounds(meanTheta, standardError);
    return _Posterior(
      theta: meanTheta,
      standardError: standardError,
      estimate: estimate,
      estimateLower: bounds.$1,
      estimateUpper: bounds.$2,
    );
  }

  bool _shouldStop(AssessmentSession session) {
    final rules = bank.stoppingRules;
    final scoringStageCount = session.scoringStageResponses.length;
    if (scoringStageCount >= rules.maximumScoringItems) return true;
    if (session.scoredResponses.length < rules.minimumScoringItems ||
        session.multipleChoiceCount < rules.minimumMultipleChoiceItems ||
        !_hasCoverageQuotas(session) ||
        session.standardError > rules.standardErrorThreshold ||
        !_hasStableEstimate(session.estimateHistory)) {
      return false;
    }

    final targetBand = _bandForEstimate(session.estimate);
    final candidate = _pickItem(
      kind: AssessmentItemKind.realWord,
      preferredBand: targetBand,
      usedItemIds: session.usedItemIds,
      salt: 900 + scoringStageCount,
    );
    final information = _itemInformation(session.theta, candidate, 0.25);
    final expectedInformationGain =
        information * session.standardError * session.standardError;
    return expectedInformationGain < rules.informationThreshold;
  }

  bool _hasStableEstimate(List<int> history) {
    if (history.length < 4) return false;
    final tail = history.sublist(history.length - 4);
    for (var index = 1; index < tail.length; index += 1) {
      final denominator = math.max(100, tail[index - 1]);
      final relativeChange =
          (tail[index] - tail[index - 1]).abs() / denominator;
      if (relativeChange >=
          bank.stoppingRules.relativeEstimateChangeThreshold) {
        return false;
      }
    }
    return true;
  }

  bool _hasCoverageQuotas(AssessmentSession session) {
    final scored = session.scoredResponses;
    final basic = scored
        .where((response) => response.frequencyBand <= 7)
        .length;
    final advanced = scored
        .where(
          (response) =>
              response.frequencyBand >= 8 && response.frequencyBand <= 14,
        )
        .length;
    return basic >= 2 && advanced >= 2 && _targetResponseCount(session) >= 2;
  }

  int _targetResponseCount(AssessmentSession session) => session.scoredResponses
      .where(
        (response) => _matchesTarget(
          response.frequencyBand,
          response.targetTags,
          session.selectedAnchor,
        ),
      )
      .length;

  bool _matchesTarget(int band, List<String> tags, AssessmentAnchor anchor) =>
      switch (anchor) {
        AssessmentAnchor.primarySchool => band <= 3,
        AssessmentAnchor.middleSchool => band >= 3 && band <= 7,
        AssessmentAnchor.highSchool => band >= 5 && band <= 10,
        AssessmentAnchor.kaoyan => tags.contains('general') && band >= 6,
        AssessmentAnchor.ielts => tags.contains('academic'),
        AssessmentAnchor.toefl => tags.contains('academic') && band >= 8,
        AssessmentAnchor.unrestricted => band >= 15,
      };

  int _targetBand(AssessmentAnchor anchor) {
    final profile = bank.profile(anchor);
    return _bandForEstimate((profile.estimateMin + profile.estimateMax) ~/ 2);
  }

  int _bandForEstimate(int estimate) => (estimate / 1000).ceil().clamp(1, 20);

  double _successProbability(
    double theta,
    AssessmentItem item,
    double guessing,
  ) {
    final logistic =
        1 / (1 + math.exp(-item.discrimination * (theta - item.difficulty)));
    return guessing + (1 - guessing) * logistic;
  }

  double _itemInformation(double theta, AssessmentItem item, double guessing) {
    final logistic =
        1 / (1 + math.exp(-item.discrimination * (theta - item.difficulty)));
    final probability = guessing + (1 - guessing) * logistic;
    final derivative =
        item.discrimination * (1 - guessing) * logistic * (1 - logistic);
    return derivative *
        derivative /
        math.max(1e-9, probability * (1 - probability));
  }

  AssessmentReliability _reliabilityFor(List<AssessmentResponse> responses) {
    final scored = responses.where((response) => response.scored).toList();
    final scoringStageCount = responses
        .where((response) => response.phase != AssessmentPhase.wrapUp)
        .length;
    final pseudowordFalsePositives = scored
        .where(
          (response) =>
              response.itemKind == AssessmentItemKind.pseudoword &&
              response.recognized == true,
        )
        .length;
    final lowEffortCount = responses
        .where((response) => response.lowEffort)
        .length;
    final contradictions = scored
        .where(
          (response) =>
              response.verifiesResponseIndex != null && !response.isCorrect,
        )
        .length;
    if ((scoringStageCount >= bank.stoppingRules.maximumScoringItems &&
            scored.length < bank.stoppingRules.minimumScoringItems) ||
        pseudowordFalsePositives >= 2 ||
        lowEffortCount >= 3 ||
        contradictions >= 2) {
      return AssessmentReliability.invalid;
    }
    if (pseudowordFalsePositives >= 1 ||
        lowEffortCount >= 2 ||
        contradictions >= 1) {
      return AssessmentReliability.caution;
    }
    return AssessmentReliability.good;
  }

  int _trailingRapidAnswerCount(List<AssessmentResponse> responses) {
    var count = 0;
    for (final response in responses.reversed) {
      if (response.skipped ||
          response.phase == AssessmentPhase.wrapUp ||
          response.responseTimeMs >= _rapidAnswerThresholdMs) {
        break;
      }
      count += 1;
    }
    return count;
  }

  AssessmentResponse _withScoringFlags(
    AssessmentResponse source, {
    required bool lowEffort,
    required bool scored,
  }) => AssessmentResponse(
    questionId: source.questionId,
    itemId: source.itemId,
    lemmaId: source.lemmaId,
    itemKind: source.itemKind,
    frequencyBand: source.frequencyBand,
    targetTags: source.targetTags,
    questionType: source.questionType,
    phase: source.phase,
    recognized: source.recognized,
    selectedOptionIndex: source.selectedOptionIndex,
    correctOptionIndex: source.correctOptionIndex,
    skipped: source.skipped,
    responseTimeMs: source.responseTimeMs,
    lowEffort: lowEffort,
    scored: scored,
    previouslyExposed: source.previouslyExposed,
    verifiesResponseIndex: source.verifiesResponseIndex,
  );

  AssessmentSession _sessionFrom({
    required AssessmentSession previous,
    required AssessmentPhase phase,
    required List<AssessmentResponse> responses,
    required _Posterior posterior,
    required AssessmentReliability reliability,
    required List<int> estimateHistory,
    required int responseTimeMs,
  }) => AssessmentSession(
    selectedAnchor: previous.selectedAnchor,
    bankVersion: previous.bankVersion,
    phase: phase,
    responses: List.unmodifiable(responses),
    usedItemIds: Set.unmodifiable(<String>{
      ...previous.usedItemIds,
      responses.last.itemId,
    }),
    theta: posterior.theta,
    standardError: posterior.standardError,
    estimate: posterior.estimate,
    estimateLower: posterior.estimateLower,
    estimateUpper: posterior.estimateUpper,
    reliability: reliability,
    estimateHistory: List.unmodifiable(estimateHistory),
    startedAt: previous.startedAt,
    durationMs: previous.durationMs + responseTimeMs,
  );

  int _estimateForTheta(double theta) {
    final raw = bank.estimateMax / (1 + math.exp(-theta));
    final rounded = (raw / 100).round() * 100;
    return rounded.clamp(bank.estimateMin, bank.estimateMax);
  }

  (int, int) _confidenceBounds(double theta, double standardError) {
    final lower = _estimateForTheta(theta - 1.96 * standardError);
    final upper = _estimateForTheta(theta + 1.96 * standardError);
    return (math.min(lower, upper), math.max(lower, upper));
  }

  void _validateSession(AssessmentSession session) {
    if (session.bankVersion != bank.bankVersion) {
      throw StateError('Assessment session belongs to another bank version');
    }
  }

  void _validateAnswer(AssessmentQuestion question, AssessmentAnswer answer) {
    if (answer.responseTimeMs < 0) {
      throw ArgumentError.value(
        answer.responseTimeMs,
        'responseTimeMs',
        'must not be negative',
      );
    }
    if (answer.skipped) return;
    if (question.type == AssessmentQuestionType.yesNo) {
      if (answer.recognized == null || answer.selectedOptionIndex != null) {
        throw ArgumentError('Yes/no question requires a recognized answer');
      }
      return;
    }
    final selectedOptionIndex = answer.selectedOptionIndex;
    if (answer.recognized != null ||
        selectedOptionIndex == null ||
        selectedOptionIndex < 0 ||
        selectedOptionIndex >= question.item.options.length) {
      throw ArgumentError('Multiple-choice answer is out of range');
    }
  }
}

class _Posterior {
  const _Posterior({
    required this.theta,
    required this.standardError,
    required this.estimate,
    required this.estimateLower,
    required this.estimateUpper,
  });

  final double theta;
  final double standardError;
  final int estimate;
  final int estimateLower;
  final int estimateUpper;
}
