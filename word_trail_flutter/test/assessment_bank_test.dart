import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/models/assessment.dart';

void main() {
  test('production assessment bank satisfies the offline release gate', () {
    final bank = AssessmentBank.decode(
      File('assets/content/assessment/bank-v1.json').readAsStringSync(),
    );

    expect(bank.schemaVersion, 2);
    expect(bank.policyVersion, 2);
    expect(bank.bankVersion, startsWith('assessment-proxy-v2-'));
    expect(bank.calibrationStatus, 'proxy-v1');
    expect(bank.anchors, hasLength(7));
    expect(bank.realItems, hasLength(1200));
    expect(bank.pseudowordItems, hasLength(240));
    expect(bank.broadPhaseRules.totalItems, 20);
    expect(bank.broadPhaseRules.realItems, 16);
    expect(bank.broadPhaseRules.pseudowordItems, 4);
    expect(bank.stoppingRules.minimumScoringItems, 48);
    expect(bank.stoppingRules.maximumScoringItems, 76);
    expect(bank.stoppingRules.wrapUpItems, 4);
    expect(bank.stoppingRules.minimumMultipleChoiceItems, 12);
    expect(bank.items.map((item) => item.itemId).toSet(), hasLength(1440));
    expect(bank.items.map((item) => item.spelling).toSet(), hasLength(1440));

    for (var band = 1; band <= 20; band += 1) {
      expect(
        bank.realItems.where((item) => item.frequencyBand == band),
        hasLength(60),
      );
      expect(
        bank.pseudowordItems.where((item) => item.frequencyBand == band),
        hasLength(12),
      );
    }
    for (final item in bank.realItems) {
      expect(item.options, hasLength(4));
      expect(item.options.toSet(), hasLength(4));
      expect(item.correctOptionIndex, inInclusiveRange(0, 3));
      expect(item.options[item.correctOptionIndex], item.meaning);
      expect(item.calibrationStatus, 'proxy-v1');
      expect(item.sourceId, isNotEmpty);
    }
    for (final item in bank.pseudowordItems) {
      expect(item.options, isEmpty);
      expect(item.meaning, isEmpty);
    }
  });

  test('assessment bank rejects malformed or unknown production data', () {
    final source = File(
      'assets/content/assessment/bank-v1.json',
    ).readAsStringSync();
    final bank = AssessmentBank.decode(source);

    expect(
      () => AssessmentBank.fromJson({
        ...bank.toJson(),
        'calibrationStatus': 'officially-calibrated',
      }),
      throwsFormatException,
    );
    expect(
      () => AssessmentBank.fromJson({...bank.toJson(), 'policyVersion': 99}),
      throwsFormatException,
    );
    expect(
      () => AssessmentBank.fromJson({
        ...bank.toJson(),
        'broadPhaseRules': {
          ...bank.broadPhaseRules.toJson(),
          'pseudowordSlots': [3, 8, 13, 20],
        },
      }),
      throwsFormatException,
    );
    expect(
      () => AssessmentBank.fromJson({
        ...bank.toJson(),
        'sourceHash': 'not-a-hash',
      }),
      throwsFormatException,
    );
    expect(
      () => AssessmentBank.fromJson({
        ...bank.toJson(),
        'stoppingRules': {
          ...bank.stoppingRules.toJson(),
          'stableEstimateChanges': 3,
        },
      }),
      throwsFormatException,
    );
    expect(
      () => AssessmentBank.fromJson({
        ...bank.toJson(),
        'items': [
          {
            ...bank.items.first.toJson(),
            'spelling': bank.items.first.spelling.toUpperCase(),
          },
          ...bank.items.skip(1).map((item) => item.toJson()),
        ],
      }),
      throwsFormatException,
    );
    expect(
      () => AssessmentBank.fromJson({
        ...bank.toJson(),
        'items': [
          ...bank.items.map((item) => item.toJson()),
          bank.items.first.toJson(),
        ],
      }),
      throwsFormatException,
    );
  });
}
