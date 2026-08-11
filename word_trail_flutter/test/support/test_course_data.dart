import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:word_trail_app/data/course_repository.dart';

class MemoryAssetBundle extends CachingAssetBundle {
  MemoryAssetBundle(this.assets);

  final Map<String, String> assets;

  @override
  Future<ByteData> load(String key) async {
    final value = assets[key];
    if (value == null) throw StateError('Missing test asset: $key');
    final bytes = Uint8List.fromList(utf8.encode(value));
    return ByteData.sublistView(bytes);
  }
}

CourseRepository testCourseRepository({
  Map<String, String> ratings = const <String, String>{},
}) {
  final specs = <_LevelSpec>[
    const _LevelSpec(
      'nce-1997-b1-level-001',
      'nce-1997',
      'nce-1997-b1',
      1,
      1,
      'CAT',
    ),
    const _LevelSpec(
      'nce-1997-b1-level-100',
      'nce-1997',
      'nce-1997-b1',
      100,
      100,
      'DOG',
    ),
    const _LevelSpec(
      'nce-1997-b2-level-001',
      'nce-1997',
      'nce-1997-b2',
      1,
      1,
      'MAP',
    ),
    const _LevelSpec(
      'nce-1997-b3-level-001',
      'nce-1997',
      'nce-1997-b3',
      1,
      1,
      'SUN',
    ),
    const _LevelSpec(
      'nce-1997-b4-level-001',
      'nce-1997',
      'nce-1997-b4',
      1,
      1,
      'SKY',
    ),
    const _LevelSpec(
      'ielts-nawl-v1-level-001',
      'ielts-nawl-v1',
      'ielts-nawl-v1-s1',
      1,
      1,
      'DATA',
    ),
    const _LevelSpec(
      'ielts-nawl-v1-level-051',
      'ielts-nawl-v1',
      'ielts-nawl-v1-s2',
      1,
      51,
      'LOGIC',
    ),
    const _LevelSpec(
      'ielts-nawl-v1-level-101',
      'ielts-nawl-v1',
      'ielts-nawl-v1-s3',
      1,
      101,
      'VALID',
    ),
    const _LevelSpec(
      'ielts-nawl-v1-level-200',
      'ielts-nawl-v1',
      'ielts-nawl-v1-s4',
      50,
      200,
      'THEORY',
    ),
  ];
  final tracks = <Map<String, dynamic>>[];
  for (var book = 1; book <= 4; book++) {
    final id = 'nce-1997-b$book';
    tracks.add({
      'id': id,
      'curriculumId': 'nce-1997',
      'titleEn': 'Book $book',
      'titleZh': '第 $book 册',
      'order': book,
      'levelIds': [
        for (final item in specs.where((item) => item.trackId == id)) item.id,
      ],
    });
  }
  for (var stage = 1; stage <= 4; stage++) {
    final id = 'ielts-nawl-v1-s$stage';
    tracks.add({
      'id': id,
      'curriculumId': 'ielts-nawl-v1',
      'titleEn': 'Stage $stage',
      'titleZh': '第 $stage 阶段',
      'order': stage,
      'levelIds': [
        for (final item in specs.where((item) => item.trackId == id)) item.id,
      ],
    });
  }
  final catalog = {
    'schemaVersion': 1,
    'contentVersion': 'test-catalog-v1',
    'curricula': [
      {
        'id': 'nce-1997',
        'titleEn': 'New Concept English',
        'titleZh': '新概念英语',
        'trackIds': [for (var book = 1; book <= 4; book++) 'nce-1997-b$book'],
      },
      {
        'id': 'ielts-nawl-v1',
        'titleEn': 'IELTS Preparation Vocabulary',
        'titleZh': 'IELTS 备考词汇',
        'trackIds': [
          for (var stage = 1; stage <= 4; stage++) 'ielts-nawl-v1-s$stage',
        ],
      },
    ],
    'tracks': tracks,
    'levels': [
      for (final item in specs)
        {
          'id': item.id,
          'curriculumId': item.curriculumId,
          'trackId': item.trackId,
          'order': item.order,
          'levelNumber': item.levelNumber,
          'rating': ratings[item.id] ?? 'all-ages',
          'assetPath': 'assets/content/levels/${item.id}.json',
        },
    ],
  };
  final assets = <String, String>{
    'assets/content/catalog.json': jsonEncode(catalog),
    for (final item in specs)
      'assets/content/levels/${item.id}.json': jsonEncode(
        _levelBundle(item, ratings[item.id] ?? 'all-ages'),
      ),
  };
  return CourseRepository(assetBundle: MemoryAssetBundle(assets));
}

Map<String, dynamic> _levelBundle(_LevelSpec item, String rating) {
  final wordId = '${item.curriculumId}-${item.word.toLowerCase()}';
  final source = item.curriculumId == 'nce-1997'
      ? {
          'type': 'nce',
          'book': int.parse(item.trackId.substring(item.trackId.length - 1)),
          'lesson': item.levelNumber,
          'provenanceId': 'test-nce',
        }
      : {
          'type': 'ielts',
          'listId': 'NAWL 1.2',
          'rank': item.levelNumber,
          'provenanceId': 'test-nawl',
        };
  return {
    'contentVersion': 'test-catalog-v1',
    'level': {
      'id': item.id,
      'curriculumId': item.curriculumId,
      'trackId': item.trackId,
      'levelNumber': item.levelNumber,
      'bookId': item.trackId,
      'unitId': '${item.trackId}-u1',
      'title': 'Test level',
      'letters': item.word.split(''),
      'targetWords': [
        {
          'id': wordId,
          'word': item.word,
          'englishMeaning': 'A test clue for ${item.word}',
          'chineseMeaning': '${item.word} 的测试提示',
          'start': {'row': 0, 'col': 0},
          'direction': 'across',
          'source': source,
        },
      ],
      'grid': {'rows': 1, 'cols': item.word.length},
      'rewardCoins': 20,
      'perfectBonusCoins': 5,
      'layoutRevision': 'test-layout-${item.levelNumber}',
    },
    'vocabulary': [
      {
        'id': wordId,
        'phonetic': '/test/',
        'partOfSpeech': 'noun',
        'examples': ['A test example.'],
        'cefrLevel': 'B1',
        'rating': rating,
      },
    ],
    'releaseStatus': 'automated-beta',
    'rating': rating,
  };
}

class _LevelSpec {
  const _LevelSpec(
    this.id,
    this.curriculumId,
    this.trackId,
    this.order,
    this.levelNumber,
    this.word,
  );

  final String id;
  final String curriculumId;
  final String trackId;
  final int order;
  final int levelNumber;
  final String word;
}
