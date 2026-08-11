import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/data/course_repository.dart';
import 'package:word_trail_app/models/course.dart';

void expectFormalBoard(CourseLevel level) {
  expect(level.rows, lessThanOrEqualTo(11), reason: level.id);
  expect(level.cols, lessThanOrEqualTo(11), reason: level.id);
  expect(
    level.words.any((word) => word.direction == WordDirection.across),
    isTrue,
    reason: level.id,
  );
  expect(
    level.words.any((word) => word.direction == WordDirection.down),
    isTrue,
    reason: level.id,
  );
  final cellOwners = <GridPoint, List<String>>{};
  for (final word in level.words) {
    for (final cell in word.cells) {
      cellOwners.putIfAbsent(cell, () => []).add(word.id);
    }
  }
  for (final word in level.words) {
    expect(
      word.cells.any((cell) => cellOwners[cell]!.length > 1),
      isTrue,
      reason: '${level.id}:${word.id} must cross another word',
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('ships 400 NCE and 200 IELTS crossword levels offline', () async {
    final repository = CourseRepository();
    final catalog = await repository.loadCatalog();
    expect(catalog.curricula.map((item) => item.id), <String>[
      'nce-1997',
      'ielts-nawl-v1',
    ]);
    expect(catalog.levels, hasLength(600));

    final nceCoreWords = <String>{};
    final nceReinforcementWords = <String>{};
    final ieltsWords = <String>{};
    final nceCoreGroups = <String>{};
    var nceCount = 0;
    var ieltsCount = 0;

    for (final entry in catalog.levels) {
      final bundle = await repository.loadLevel(entry.id);
      final level = bundle.level;
      expect(level.curriculumId, entry.curriculumId);
      expect(level.trackId, entry.trackId);
      expect(level.levelNumber, entry.levelNumber);
      expectFormalBoard(level);

      if (entry.curriculumId == 'nce-1997') {
        nceCount++;
        final book = int.parse(
          entry.trackId.substring(entry.trackId.length - 1),
        );
        for (final word in level.words) {
          expect(word.source.type, VocabularySourceType.nce);
          expect(word.source.book, book);
          expect(word.source.lesson, greaterThan(0));
          final scopedSpelling = '$book:${word.word}';
          if (entry.levelNumber <= 50) {
            expect(nceCoreWords.add(scopedSpelling), isTrue);
          } else {
            expect(nceReinforcementWords.add(scopedSpelling), isTrue);
          }
        }
        final signature =
            '$book:${level.words.map((word) => word.word).toList()..sort()}';
        if (entry.levelNumber <= 50) {
          nceCoreGroups.add(signature);
        } else {
          expect(nceCoreGroups.contains(signature), isFalse, reason: level.id);
        }
      } else {
        ieltsCount++;
        expect(level.words, hasLength(3));
        for (final word in level.words) {
          expect(word.source.type, VocabularySourceType.ielts);
          expect(word.source.listId, 'NAWL-1.2');
          expect(word.source.rank, greaterThan(0));
          expect(ieltsWords.add(word.word), isTrue, reason: word.word);
        }
      }
    }

    expect(nceCount, 400);
    expect(ieltsCount, 200);
    expect(nceCoreWords, hasLength(800));
    expect(nceReinforcementWords, nceCoreWords);
    expect(ieltsWords, hasLength(600));
  });
}
