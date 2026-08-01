import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/data/course_repository.dart';
import 'package:word_trail_app/models/course.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('ships 200 bounded connected crossword levels offline', () async {
    final repository = CourseRepository();
    final globalWords = <String>{};
    var levelCount = 0;

    for (var book = 1; book <= 4; book++) {
      for (var levelNumber = 1; levelNumber <= 50; levelNumber++) {
        final bundle = await repository.loadLevel(
          CourseRepository.levelId(book, levelNumber),
        );
        final level = bundle.level;
        levelCount++;
        expect(level.rows, lessThanOrEqualTo(11));
        expect(level.cols, lessThanOrEqualTo(11));
        expect(
          level.words.any((word) => word.direction == WordDirection.across),
          isTrue,
        );
        expect(
          level.words.any((word) => word.direction == WordDirection.down),
          isTrue,
        );

        final cellOwners = <GridPoint, List<String>>{};
        for (final word in level.words) {
          expect(globalWords.add(word.word), isTrue, reason: word.word);
          expect(word.source.book, book);
          expect(word.source.lesson, greaterThan(0));
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
    }

    expect(levelCount, 200);
    expect(globalWords.length, 800);
  });
}

