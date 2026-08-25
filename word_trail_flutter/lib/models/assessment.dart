import 'dart:convert';

enum AssessmentAnchor {
  primarySchool,
  middleSchool,
  highSchool,
  kaoyan,
  ielts,
  toefl,
  unrestricted,
}

enum AssessmentItemKind { realWord, pseudoword }

enum AssessmentQuestionType { yesNo, multipleChoice }

enum AssessmentPhase { broad, adaptive, wrapUp, complete }

enum AssessmentReliability { good, caution, invalid }

T _enumByName<T extends Enum>(Iterable<T> values, Object? value, String field) {
  final name = value as String?;
  return values.firstWhere(
    (item) => item.name == name,
    orElse: () => throw FormatException('Unknown $field: $name'),
  );
}

class AssessmentAnchorProfile {
  const AssessmentAnchorProfile({
    required this.anchor,
    required this.estimateMin,
    required this.estimateMax,
    required this.priorMeanTheta,
    required this.priorStandardDeviation,
  });

  final AssessmentAnchor anchor;
  final int estimateMin;
  final int estimateMax;
  final double priorMeanTheta;
  final double priorStandardDeviation;

  factory AssessmentAnchorProfile.fromJson(Map<String, dynamic> json) {
    final profile = AssessmentAnchorProfile(
      anchor: _enumByName(
        AssessmentAnchor.values,
        json['id'],
        'assessment anchor',
      ),
      estimateMin: (json['estimateMin'] as num).toInt(),
      estimateMax: (json['estimateMax'] as num).toInt(),
      priorMeanTheta: (json['priorMeanTheta'] as num).toDouble(),
      priorStandardDeviation: (json['priorStandardDeviation'] as num)
          .toDouble(),
    );
    if (profile.estimateMin < 0 ||
        profile.estimateMax <= profile.estimateMin ||
        profile.estimateMax > 20000 ||
        profile.priorStandardDeviation <= 0) {
      throw const FormatException('Invalid assessment anchor profile');
    }
    return profile;
  }

  Map<String, dynamic> toJson() => {
    'id': anchor.name,
    'estimateMin': estimateMin,
    'estimateMax': estimateMax,
    'priorMeanTheta': priorMeanTheta,
    'priorStandardDeviation': priorStandardDeviation,
  };
}

class AssessmentStoppingRules {
  const AssessmentStoppingRules({
    required this.minimumScoringItems,
    required this.maximumScoringItems,
    required this.wrapUpItems,
    required this.minimumMultipleChoiceItems,
    required this.minimumBasicItems,
    required this.minimumAdvancedItems,
    required this.minimumTargetItems,
    required this.standardErrorThreshold,
    required this.relativeEstimateChangeThreshold,
    required this.stableEstimateChanges,
    required this.informationThreshold,
  });

  final int minimumScoringItems;
  final int maximumScoringItems;
  final int wrapUpItems;
  final int minimumMultipleChoiceItems;
  final int minimumBasicItems;
  final int minimumAdvancedItems;
  final int minimumTargetItems;
  final double standardErrorThreshold;
  final double relativeEstimateChangeThreshold;
  final int stableEstimateChanges;
  final double informationThreshold;

  factory AssessmentStoppingRules.fromJson(Map<String, dynamic> json) {
    final rules = AssessmentStoppingRules(
      minimumScoringItems: (json['minimumScoringItems'] as num).toInt(),
      maximumScoringItems: (json['maximumScoringItems'] as num).toInt(),
      wrapUpItems: (json['wrapUpItems'] as num).toInt(),
      minimumMultipleChoiceItems: (json['minimumMultipleChoiceItems'] as num)
          .toInt(),
      minimumBasicItems: (json['minimumBasicItems'] as num).toInt(),
      minimumAdvancedItems: (json['minimumAdvancedItems'] as num).toInt(),
      minimumTargetItems: (json['minimumTargetItems'] as num).toInt(),
      standardErrorThreshold: (json['standardErrorThreshold'] as num)
          .toDouble(),
      relativeEstimateChangeThreshold:
          (json['relativeEstimateChangeThreshold'] as num).toDouble(),
      stableEstimateChanges: (json['stableEstimateChanges'] as num).toInt(),
      informationThreshold: (json['informationThreshold'] as num).toDouble(),
    );
    if (rules.minimumScoringItems != 48 ||
        rules.maximumScoringItems != 76 ||
        rules.wrapUpItems != 4 ||
        rules.minimumMultipleChoiceItems != 12 ||
        rules.minimumBasicItems != 4 ||
        rules.minimumAdvancedItems != 4 ||
        rules.minimumTargetItems != 4 ||
        rules.standardErrorThreshold != 0.32 ||
        rules.relativeEstimateChangeThreshold != 0.03 ||
        rules.stableEstimateChanges != 6 ||
        rules.informationThreshold != 0.08) {
      throw const FormatException('Invalid assessment stopping rules');
    }
    return rules;
  }

  Map<String, dynamic> toJson() => {
    'minimumScoringItems': minimumScoringItems,
    'maximumScoringItems': maximumScoringItems,
    'wrapUpItems': wrapUpItems,
    'minimumMultipleChoiceItems': minimumMultipleChoiceItems,
    'minimumBasicItems': minimumBasicItems,
    'minimumAdvancedItems': minimumAdvancedItems,
    'minimumTargetItems': minimumTargetItems,
    'standardErrorThreshold': standardErrorThreshold,
    'relativeEstimateChangeThreshold': relativeEstimateChangeThreshold,
    'stableEstimateChanges': stableEstimateChanges,
    'informationThreshold': informationThreshold,
  };
}

class AssessmentBroadPhaseRules {
  const AssessmentBroadPhaseRules({
    required this.totalItems,
    required this.realItems,
    required this.pseudowordItems,
    required this.realBands,
    required this.pseudowordSlots,
    required this.pseudowordBands,
  });

  final int totalItems;
  final int realItems;
  final int pseudowordItems;
  final List<int> realBands;
  final List<int> pseudowordSlots;
  final List<int> pseudowordBands;

  factory AssessmentBroadPhaseRules.fromJson(Map<String, dynamic> json) {
    final rules = AssessmentBroadPhaseRules(
      totalItems: (json['totalItems'] as num).toInt(),
      realItems: (json['realItems'] as num).toInt(),
      pseudowordItems: (json['pseudowordItems'] as num).toInt(),
      realBands: (json['realBands'] as List<dynamic>)
          .map((value) => (value as num).toInt())
          .toList(growable: false),
      pseudowordSlots: (json['pseudowordSlots'] as List<dynamic>)
          .map((value) => (value as num).toInt())
          .toList(growable: false),
      pseudowordBands: (json['pseudowordBands'] as List<dynamic>)
          .map((value) => (value as num).toInt())
          .toList(growable: false),
    );
    if (rules.totalItems != 20 ||
        rules.realItems != 16 ||
        rules.pseudowordItems != 4 ||
        rules.realItems + rules.pseudowordItems != rules.totalItems ||
        rules.realBands.length != rules.realItems ||
        rules.pseudowordSlots.length != rules.pseudowordItems ||
        rules.pseudowordBands.length != rules.pseudowordItems ||
        rules.realBands.join(',') !=
            '1,2,3,5,6,7,8,10,11,12,13,15,16,17,18,20' ||
        rules.pseudowordSlots.join(',') != '3,8,13,18' ||
        rules.pseudowordBands.join(',') != '4,9,14,19' ||
        rules.pseudowordSlots.toSet().length != rules.pseudowordSlots.length ||
        rules.pseudowordSlots.any(
          (slot) => slot < 0 || slot >= rules.totalItems,
        ) ||
        <int>{
          ...rules.realBands,
          ...rules.pseudowordBands,
        }.any((band) => band < 1 || band > 20)) {
      throw const FormatException('Invalid assessment broad phase rules');
    }
    return rules;
  }

  Map<String, dynamic> toJson() => {
    'totalItems': totalItems,
    'realItems': realItems,
    'pseudowordItems': pseudowordItems,
    'realBands': realBands,
    'pseudowordSlots': pseudowordSlots,
    'pseudowordBands': pseudowordBands,
  };
}

class AssessmentItem {
  const AssessmentItem({
    required this.itemId,
    required this.lemmaId,
    required this.kind,
    required this.spelling,
    required this.frequencyBand,
    required this.targetTags,
    required this.meaning,
    required this.partOfSpeech,
    required this.options,
    required this.correctOptionIndex,
    required this.difficulty,
    required this.discrimination,
    required this.guessing,
    required this.calibrationStatus,
    required this.sourceId,
  });

  final String itemId;
  final String lemmaId;
  final AssessmentItemKind kind;
  final String spelling;
  final int frequencyBand;
  final List<String> targetTags;
  final String meaning;
  final String partOfSpeech;
  final List<String> options;
  final int correctOptionIndex;
  final double difficulty;
  final double discrimination;
  final double guessing;
  final String calibrationStatus;
  final String sourceId;

  bool get isRealWord => kind == AssessmentItemKind.realWord;

  factory AssessmentItem.fromJson(Map<String, dynamic> json) {
    final item = AssessmentItem(
      itemId: json['itemId'] as String,
      lemmaId: json['lemmaId'] as String,
      kind: _enumByName(
        AssessmentItemKind.values,
        json['itemType'],
        'assessment item type',
      ),
      spelling: json['spelling'] as String,
      frequencyBand: (json['frequencyBand'] as num).toInt(),
      targetTags: (json['targetTags'] as List<dynamic>).cast<String>(),
      meaning: json['meaning'] as String,
      partOfSpeech: json['partOfSpeech'] as String,
      options: (json['options'] as List<dynamic>).cast<String>(),
      correctOptionIndex: (json['correctOptionIndex'] as num).toInt(),
      difficulty: (json['difficulty'] as num).toDouble(),
      discrimination: (json['discrimination'] as num).toDouble(),
      guessing: (json['guessing'] as num).toDouble(),
      calibrationStatus: json['calibrationStatus'] as String,
      sourceId: json['sourceId'] as String,
    );
    item._validate();
    return item;
  }

  void _validate() {
    if (itemId.trim().isEmpty ||
        lemmaId.trim().isEmpty ||
        !RegExp(r'^[a-z]{3,12}$').hasMatch(spelling) ||
        frequencyBand < 1 ||
        frequencyBand > 20 ||
        targetTags.isEmpty ||
        targetTags.toSet().length != targetTags.length ||
        discrimination <= 0 ||
        guessing < 0 ||
        guessing >= 1 ||
        calibrationStatus != 'proxy-v1' ||
        sourceId.trim().isEmpty) {
      throw FormatException('Invalid assessment item: $itemId');
    }
    if (isRealWord) {
      if (meaning.trim().isEmpty ||
          partOfSpeech.trim().isEmpty ||
          options.length != 4 ||
          options.toSet().length != 4 ||
          correctOptionIndex < 0 ||
          correctOptionIndex >= options.length ||
          options[correctOptionIndex] != meaning ||
          guessing != 0.25) {
        throw FormatException('Invalid real-word assessment item: $itemId');
      }
    } else if (meaning.isNotEmpty ||
        partOfSpeech.isNotEmpty ||
        options.isNotEmpty ||
        correctOptionIndex != -1 ||
        guessing != 0) {
      throw FormatException('Invalid pseudoword assessment item: $itemId');
    }
  }

  Map<String, dynamic> toJson() => {
    'itemId': itemId,
    'lemmaId': lemmaId,
    'itemType': kind.name,
    'spelling': spelling,
    'frequencyBand': frequencyBand,
    'targetTags': targetTags,
    'meaning': meaning,
    'partOfSpeech': partOfSpeech,
    'options': options,
    'correctOptionIndex': correctOptionIndex,
    'difficulty': difficulty,
    'discrimination': discrimination,
    'guessing': guessing,
    'calibrationStatus': calibrationStatus,
    'sourceId': sourceId,
  };
}

class AssessmentBank {
  const AssessmentBank({
    required this.schemaVersion,
    required this.policyVersion,
    required this.bankVersion,
    required this.estimateMin,
    required this.estimateMax,
    required this.calibrationStatus,
    required this.generatorVersion,
    required this.sourceHash,
    required this.anchors,
    required this.broadPhaseRules,
    required this.stoppingRules,
    required this.items,
  });

  final int schemaVersion;
  final int policyVersion;
  final String bankVersion;
  final int estimateMin;
  final int estimateMax;
  final String calibrationStatus;
  final String generatorVersion;
  final String sourceHash;
  final List<AssessmentAnchorProfile> anchors;
  final AssessmentBroadPhaseRules broadPhaseRules;
  final AssessmentStoppingRules stoppingRules;
  final List<AssessmentItem> items;

  List<AssessmentItem> get realItems => items
      .where((item) => item.kind == AssessmentItemKind.realWord)
      .toList(growable: false);

  List<AssessmentItem> get pseudowordItems => items
      .where((item) => item.kind == AssessmentItemKind.pseudoword)
      .toList(growable: false);

  AssessmentAnchorProfile profile(AssessmentAnchor anchor) =>
      anchors.firstWhere((profile) => profile.anchor == anchor);

  factory AssessmentBank.decode(String source) =>
      AssessmentBank.fromJson(jsonDecode(source) as Map<String, dynamic>);

  factory AssessmentBank.fromJson(Map<String, dynamic> json) {
    final range = json['estimateRange'] as Map<String, dynamic>;
    final bank = AssessmentBank(
      schemaVersion: (json['schemaVersion'] as num).toInt(),
      policyVersion: (json['policyVersion'] as num).toInt(),
      bankVersion: json['bankVersion'] as String,
      estimateMin: (range['min'] as num).toInt(),
      estimateMax: (range['max'] as num).toInt(),
      calibrationStatus: json['calibrationStatus'] as String,
      generatorVersion: json['generatorVersion'] as String,
      sourceHash: json['sourceHash'] as String,
      anchors: (json['anchorProfiles'] as List<dynamic>)
          .map(
            (item) =>
                AssessmentAnchorProfile.fromJson(item as Map<String, dynamic>),
          )
          .toList(growable: false),
      broadPhaseRules: AssessmentBroadPhaseRules.fromJson(
        json['broadPhaseRules'] as Map<String, dynamic>,
      ),
      stoppingRules: AssessmentStoppingRules.fromJson(
        json['stoppingRules'] as Map<String, dynamic>,
      ),
      items: (json['items'] as List<dynamic>)
          .map((item) => AssessmentItem.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
    );
    bank._validate();
    return bank;
  }

  void _validate() {
    if (schemaVersion != 2 ||
        policyVersion != 2 ||
        !bankVersion.startsWith('assessment-proxy-v2-') ||
        estimateMin != 0 ||
        estimateMax != 20000 ||
        calibrationStatus != 'proxy-v1' ||
        generatorVersion != 'assessment-bank-generator-v2' ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(sourceHash) ||
        bankVersion != 'assessment-proxy-v2-${sourceHash.substring(0, 16)}' ||
        anchors.length != AssessmentAnchor.values.length ||
        anchors.map((item) => item.anchor).toSet().length != anchors.length ||
        items.length != 1440 ||
        items.map((item) => item.itemId).toSet().length != items.length ||
        items.map((item) => item.lemmaId).toSet().length != items.length ||
        items.map((item) => item.spelling).toSet().length != items.length ||
        realItems.length != 1200 ||
        pseudowordItems.length != 240) {
      throw const FormatException('Invalid assessment bank manifest');
    }
    for (var band = 1; band <= 20; band += 1) {
      final realCount = realItems
          .where((item) => item.frequencyBand == band)
          .length;
      final pseudoCount = pseudowordItems
          .where((item) => item.frequencyBand == band)
          .length;
      if (realCount != 60 || pseudoCount != 12) {
        throw FormatException('Invalid assessment frequency band: $band');
      }
    }
  }

  Map<String, dynamic> toJson() => {
    'schemaVersion': schemaVersion,
    'policyVersion': policyVersion,
    'bankVersion': bankVersion,
    'estimateRange': {'min': estimateMin, 'max': estimateMax},
    'calibrationStatus': calibrationStatus,
    'generatorVersion': generatorVersion,
    'sourceHash': sourceHash,
    'anchorProfiles': anchors.map((item) => item.toJson()).toList(),
    'broadPhaseRules': broadPhaseRules.toJson(),
    'stoppingRules': stoppingRules.toJson(),
    'items': items.map((item) => item.toJson()).toList(),
  };
}

class AssessmentQuestion {
  const AssessmentQuestion({
    required this.questionId,
    required this.item,
    required this.type,
    required this.phase,
    required this.previouslyExposed,
    this.verifiesResponseIndex,
  });

  final String questionId;
  final AssessmentItem item;
  final AssessmentQuestionType type;
  final AssessmentPhase phase;
  final bool previouslyExposed;
  final int? verifiesResponseIndex;
}

class AssessmentAnswer {
  const AssessmentAnswer._({
    required this.recognized,
    required this.selectedOptionIndex,
    required this.skipped,
    required this.responseTimeMs,
  });

  const AssessmentAnswer.yesNo({
    required bool recognized,
    required int responseTimeMs,
  }) : this._(
         recognized: recognized,
         selectedOptionIndex: null,
         skipped: false,
         responseTimeMs: responseTimeMs,
       );

  const AssessmentAnswer.multipleChoice({
    required int selectedOptionIndex,
    required int responseTimeMs,
  }) : this._(
         recognized: null,
         selectedOptionIndex: selectedOptionIndex,
         skipped: false,
         responseTimeMs: responseTimeMs,
       );

  const AssessmentAnswer.skipped({required int responseTimeMs})
    : this._(
        recognized: null,
        selectedOptionIndex: null,
        skipped: true,
        responseTimeMs: responseTimeMs,
      );

  final bool? recognized;
  final int? selectedOptionIndex;
  final bool skipped;
  final int responseTimeMs;
}

class AssessmentResponse {
  const AssessmentResponse({
    required this.questionId,
    required this.itemId,
    required this.lemmaId,
    required this.itemKind,
    required this.frequencyBand,
    required this.targetTags,
    required this.questionType,
    required this.phase,
    required this.recognized,
    required this.selectedOptionIndex,
    required this.correctOptionIndex,
    required this.skipped,
    required this.responseTimeMs,
    required this.lowEffort,
    required this.scored,
    required this.previouslyExposed,
    required this.verifiesResponseIndex,
  });

  final String questionId;
  final String itemId;
  final String lemmaId;
  final AssessmentItemKind itemKind;
  final int frequencyBand;
  final List<String> targetTags;
  final AssessmentQuestionType questionType;
  final AssessmentPhase phase;
  final bool? recognized;
  final int? selectedOptionIndex;
  final int correctOptionIndex;
  final bool skipped;
  final int responseTimeMs;
  final bool lowEffort;
  final bool scored;
  final bool previouslyExposed;
  final int? verifiesResponseIndex;

  bool get isCorrect => questionType == AssessmentQuestionType.yesNo
      ? itemKind == AssessmentItemKind.realWord
            ? recognized == true
            : recognized == false
      : selectedOptionIndex == correctOptionIndex;

  Map<String, dynamic> toJson() => {
    'questionId': questionId,
    'itemId': itemId,
    'lemmaId': lemmaId,
    'itemKind': itemKind.name,
    'frequencyBand': frequencyBand,
    'targetTags': targetTags,
    'questionType': questionType.name,
    'phase': phase.name,
    'recognized': recognized,
    'selectedOptionIndex': selectedOptionIndex,
    'correctOptionIndex': correctOptionIndex,
    'skipped': skipped,
    'responseTimeMs': responseTimeMs,
    'lowEffort': lowEffort,
    'scored': scored,
    'previouslyExposed': previouslyExposed,
    'verifiesResponseIndex': verifiesResponseIndex,
  };

  factory AssessmentResponse.fromJson(Map<String, dynamic> json) =>
      AssessmentResponse(
        questionId: json['questionId'] as String,
        itemId: json['itemId'] as String,
        lemmaId: json['lemmaId'] as String,
        itemKind: _enumByName(
          AssessmentItemKind.values,
          json['itemKind'],
          'assessment response item kind',
        ),
        frequencyBand: (json['frequencyBand'] as num).toInt(),
        targetTags: (json['targetTags'] as List<dynamic>).cast<String>(),
        questionType: _enumByName(
          AssessmentQuestionType.values,
          json['questionType'],
          'assessment question type',
        ),
        phase: _enumByName(
          AssessmentPhase.values,
          json['phase'],
          'assessment phase',
        ),
        recognized: json['recognized'] as bool?,
        selectedOptionIndex: (json['selectedOptionIndex'] as num?)?.toInt(),
        correctOptionIndex: (json['correctOptionIndex'] as num).toInt(),
        skipped: json['skipped'] as bool,
        responseTimeMs: (json['responseTimeMs'] as num).toInt(),
        lowEffort: json['lowEffort'] as bool,
        scored: json['scored'] as bool,
        previouslyExposed: json['previouslyExposed'] as bool,
        verifiesResponseIndex: (json['verifiesResponseIndex'] as num?)?.toInt(),
      );
}

class AssessmentSession {
  const AssessmentSession({
    required this.selectedAnchor,
    required this.bankVersion,
    required this.phase,
    required this.responses,
    required this.usedItemIds,
    required this.theta,
    required this.standardError,
    required this.estimate,
    required this.estimateLower,
    required this.estimateUpper,
    required this.reliability,
    required this.estimateHistory,
    required this.startedAt,
    required this.durationMs,
  });

  final AssessmentAnchor selectedAnchor;
  final String bankVersion;
  final AssessmentPhase phase;
  final List<AssessmentResponse> responses;
  final Set<String> usedItemIds;
  final double theta;
  final double standardError;
  final int estimate;
  final int estimateLower;
  final int estimateUpper;
  final AssessmentReliability reliability;
  final List<int> estimateHistory;
  final DateTime startedAt;
  final int durationMs;

  bool get isComplete => phase == AssessmentPhase.complete;

  List<AssessmentResponse> get scoringStageResponses => responses
      .where((response) => response.phase != AssessmentPhase.wrapUp)
      .toList(growable: false);

  List<AssessmentResponse> get scoredResponses =>
      responses.where((response) => response.scored).toList(growable: false);

  List<AssessmentResponse> get wrapUpResponses => responses
      .where((response) => response.phase == AssessmentPhase.wrapUp)
      .toList(growable: false);

  int get multipleChoiceCount => scoredResponses
      .where(
        (response) =>
            response.questionType == AssessmentQuestionType.multipleChoice,
      )
      .length;

  int get pseudowordFalsePositives => scoredResponses
      .where(
        (response) =>
            response.itemKind == AssessmentItemKind.pseudoword &&
            response.recognized == true,
      )
      .length;

  int get lowEffortCount =>
      responses.where((response) => response.lowEffort).length;

  Map<String, double> get coverageProfile {
    double mastery(Iterable<AssessmentResponse> source) {
      final usable = source
          .where(
            (response) =>
                response.scored &&
                response.itemKind == AssessmentItemKind.realWord,
          )
          .toList();
      if (usable.isEmpty) return 0;
      final correct = usable.where((response) => response.isCorrect).length;
      return correct / usable.length;
    }

    return {
      'basic': mastery(
        responses.where((response) => response.frequencyBand <= 7),
      ),
      'advanced': mastery(
        responses.where(
          (response) =>
              response.frequencyBand >= 8 && response.frequencyBand <= 14,
        ),
      ),
      'target': mastery(responses.where(_matchesSelectedTarget)),
    };
  }

  bool _matchesSelectedTarget(
    AssessmentResponse response,
  ) => switch (selectedAnchor) {
    AssessmentAnchor.primarySchool => response.frequencyBand <= 3,
    AssessmentAnchor.middleSchool =>
      response.frequencyBand >= 3 && response.frequencyBand <= 7,
    AssessmentAnchor.highSchool =>
      response.frequencyBand >= 5 && response.frequencyBand <= 10,
    AssessmentAnchor.kaoyan =>
      response.targetTags.contains('general') && response.frequencyBand >= 6,
    AssessmentAnchor.ielts => response.targetTags.contains('academic'),
    AssessmentAnchor.toefl =>
      response.targetTags.contains('academic') && response.frequencyBand >= 8,
    AssessmentAnchor.unrestricted => response.frequencyBand >= 15,
  };

  Map<String, dynamic> toJson() => {
    'selectedAnchor': selectedAnchor.name,
    'bankVersion': bankVersion,
    'phase': phase.name,
    'responses': responses.map((response) => response.toJson()).toList(),
    'usedItemIds': usedItemIds.toList()..sort(),
    'theta': theta,
    'standardError': standardError,
    'estimate': estimate,
    'estimateLower': estimateLower,
    'estimateUpper': estimateUpper,
    'reliability': reliability.name,
    'estimateHistory': estimateHistory,
    'startedAt': startedAt.toIso8601String(),
    'durationMs': durationMs,
  };

  factory AssessmentSession.fromJson(Map<String, dynamic> json) =>
      AssessmentSession(
        selectedAnchor: _enumByName(
          AssessmentAnchor.values,
          json['selectedAnchor'],
          'assessment anchor',
        ),
        bankVersion: json['bankVersion'] as String,
        phase: _enumByName(
          AssessmentPhase.values,
          json['phase'],
          'assessment phase',
        ),
        responses: (json['responses'] as List<dynamic>)
            .map(
              (item) =>
                  AssessmentResponse.fromJson(item as Map<String, dynamic>),
            )
            .toList(growable: false),
        usedItemIds: (json['usedItemIds'] as List<dynamic>)
            .cast<String>()
            .toSet(),
        theta: (json['theta'] as num).toDouble(),
        standardError: (json['standardError'] as num).toDouble(),
        estimate: (json['estimate'] as num).toInt(),
        estimateLower: (json['estimateLower'] as num).toInt(),
        estimateUpper: (json['estimateUpper'] as num).toInt(),
        reliability: _enumByName(
          AssessmentReliability.values,
          json['reliability'],
          'assessment reliability',
        ),
        estimateHistory: (json['estimateHistory'] as List<dynamic>)
            .map((value) => (value as num).toInt())
            .toList(growable: false),
        startedAt: DateTime.parse(json['startedAt'] as String),
        durationMs: (json['durationMs'] as num).toInt(),
      );
}

class AssessmentStep {
  const AssessmentStep({
    required this.session,
    required this.showCarefulAnswerWarning,
    required this.lockInputFor,
  });

  final AssessmentSession session;
  final bool showCarefulAnswerWarning;
  final Duration lockInputFor;
}
