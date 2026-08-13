import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/models/assessment.dart';

void main() {
  test('production assessment bank satisfies the offline release gate', () {
    final bank = AssessmentBank.decode(
      File('assets/content/assessment/bank-v1.json').readAsStringSync(),
    );

    expect(bank.schemaVersion, 1);
    expect(bank.bankVersion, startsWith('assessment-proxy-v1-'));
    expect(bank.calibrationStatus, 'proxy-v1');
    expect(bank.anchors, hasLength(7));
    expect(bank.realItems, hasLength(1200));
    expect(bank.pseudowordItems, hasLength(240));
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
