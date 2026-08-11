import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/data/course_repository.dart';
import 'package:word_trail_app/models/course.dart';

import 'support/test_course_data.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'catalog parses and is cached as the navigation source of truth',
    () async {
      final repository = testCourseRepository();
      final first = await repository.loadCatalog();
      final second = await repository.loadCatalog();

      expect(identical(first, second), isTrue);
      expect(first.contentVersion, 'test-catalog-v1');
      expect(first.curricula.map((item) => item.id), [
        'nce-1997',
        'ielts-nawl-v1',
      ]);
      expect(first.tracksFor('nce-1997'), hasLength(4));
      expect(first.tracksFor('ielts-nawl-v1'), hasLength(4));
    },
  );

  test('repository only loads level assets listed by catalog', () async {
    final repository = testCourseRepository();
    final nce = await repository.loadLevel('nce-1997-b1-level-001');
    final ielts = await repository.loadLevel('ielts-nawl-v1-level-001');

    expect(nce.level.curriculumId, 'nce-1997');
    expect(nce.level.trackId, 'nce-1997-b1');
    expect(nce.level.levelNumber, 1);
    expect(nce.level.words.single.source.type, VocabularySourceType.nce);
    expect(ielts.level.curriculumId, 'ielts-nawl-v1');
    expect(ielts.level.words.single.source.type, VocabularySourceType.ielts);
    expect(ielts.level.words.single.source.listId, 'NAWL 1.2');

    expect(
      () => repository.loadLevel('assets/content/levels/../../secret'),
      throwsArgumentError,
    );
  });

  test('catalog rejects empty topology and a missing default course', () {
    expect(
      () => CurriculumCatalog.fromJson({
        'schemaVersion': 1,
        'contentVersion': 'test-v1',
        'curricula': <Object>[],
        'tracks': <Object>[],
        'levels': <Object>[],
      }),
      throwsFormatException,
    );

    final missingDefault = _validCatalog();
    (missingDefault['curricula'] as List<dynamic>).first['id'] = 'other';
    (missingDefault['curricula'] as List<dynamic>).first['trackIds'] =
        <String>[];
    expect(
      () => CurriculumCatalog.fromJson(missingDefault),
      throwsFormatException,
    );
  });

  test('catalog rejects disconnected tracks and levels', () {
    final orphanTrack = _validCatalog();
    (orphanTrack['tracks'] as List<dynamic>).add({
      'id': 'nce-1997-orphan',
      'curriculumId': 'nce-1997',
      'titleEn': 'Orphan',
      'titleZh': '断开的分册',
      'order': 2,
      'levelIds': ['nce-1997-orphan-level-001'],
    });
    (orphanTrack['levels'] as List<dynamic>).add({
      'id': 'nce-1997-orphan-level-001',
      'curriculumId': 'nce-1997',
      'trackId': 'nce-1997-orphan',
      'order': 1,
      'levelNumber': 1,
      'rating': 'all-ages',
      'assetPath': 'assets/content/levels/orphan.json',
    });
    expect(
      () => CurriculumCatalog.fromJson(orphanTrack),
      throwsFormatException,
    );

    final orphanLevel = _validCatalog();
    (orphanLevel['levels'] as List<dynamic>).add({
      'id': 'nce-1997-b1-level-002',
      'curriculumId': 'nce-1997',
      'trackId': 'nce-1997-b1',
      'order': 2,
      'levelNumber': 2,
      'rating': 'all-ages',
      'assetPath': 'assets/content/levels/nce-1997-b1-level-002.json',
    });
    expect(
      () => CurriculumCatalog.fromJson(orphanLevel),
      throwsFormatException,
    );
  });

  test('repository rejects a level bundle from another content version', () {
    final repository = CourseRepository(
      assetBundle: MemoryAssetBundle({
        'assets/content/catalog.json': jsonEncode(_validCatalog()),
        'assets/content/levels/nce-1997-b1-level-001.json': jsonEncode(
          _validBundle(contentVersion: 'other-version'),
        ),
      }),
    );

    expect(
      repository.loadLevel('nce-1997-b1-level-001'),
      throwsFormatException,
    );
  });
}

Map<String, dynamic> _validCatalog() => {
  'schemaVersion': 1,
  'contentVersion': 'test-v1',
  'curricula': [
    {
      'id': 'nce-1997',
      'titleEn': 'New Concept English',
      'titleZh': '新概念英语',
      'trackIds': ['nce-1997-b1'],
    },
  ],
  'tracks': [
    {
      'id': 'nce-1997-b1',
      'curriculumId': 'nce-1997',
      'titleEn': 'Book 1',
      'titleZh': '第 1 册',
      'order': 1,
      'levelIds': ['nce-1997-b1-level-001'],
    },
  ],
  'levels': [
    {
      'id': 'nce-1997-b1-level-001',
      'curriculumId': 'nce-1997',
      'trackId': 'nce-1997-b1',
      'order': 1,
      'levelNumber': 1,
      'rating': 'all-ages',
      'assetPath': 'assets/content/levels/nce-1997-b1-level-001.json',
    },
  ],
};

Map<String, dynamic> _validBundle({required String contentVersion}) => {
  'contentVersion': contentVersion,
  'level': {
    'id': 'nce-1997-b1-level-001',
    'curriculumId': 'nce-1997',
    'trackId': 'nce-1997-b1',
    'levelNumber': 1,
    'bookId': 'nce-1997-b1',
    'unitId': 'nce-1997-b1-u1',
    'title': 'Test level',
    'letters': ['C', 'A', 'T'],
    'targetWords': [
      {
        'id': 'nce-1997-cat',
        'word': 'CAT',
        'englishMeaning': 'A test clue',
        'chineseMeaning': '测试提示',
        'start': {'row': 0, 'col': 0},
        'direction': 'across',
        'source': {
          'type': 'nce',
          'book': 1,
          'lesson': 1,
          'provenanceId': 'test',
        },
      },
    ],
    'grid': {'rows': 1, 'cols': 3},
    'rewardCoins': 20,
    'perfectBonusCoins': 5,
    'layoutRevision': 'test-layout',
  },
  'vocabulary': [
    {
      'id': 'nce-1997-cat',
      'phonetic': '/test/',
      'partOfSpeech': 'noun',
      'examples': ['A test example.'],
      'cefrLevel': 'A1',
      'rating': 'all-ages',
    },
  ],
  'releaseStatus': 'automated-beta',
  'rating': 'all-ages',
};
