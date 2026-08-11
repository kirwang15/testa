import 'dart:convert';

enum WordDirection { across, down }

enum VocabularySourceType { nce, ielts }

class GridPoint {
  const GridPoint(this.row, this.col);

  final int row;
  final int col;

  String get key => '$row:$col';

  @override
  bool operator ==(Object other) =>
      other is GridPoint && row == other.row && col == other.col;

  @override
  int get hashCode => Object.hash(row, col);
}

class CurriculumCatalog {
  const CurriculumCatalog({
    required this.schemaVersion,
    required this.contentVersion,
    required this.curricula,
    required this.tracks,
    required this.levels,
  });

  final int schemaVersion;
  final String contentVersion;
  final List<Curriculum> curricula;
  final List<CourseTrack> tracks;
  final List<CatalogLevel> levels;

  factory CurriculumCatalog.decode(String source) =>
      CurriculumCatalog.fromJson(jsonDecode(source) as Map<String, dynamic>);

  factory CurriculumCatalog.fromJson(Map<String, dynamic> json) {
    final catalog = CurriculumCatalog(
      schemaVersion: (json['schemaVersion'] as num).toInt(),
      contentVersion: json['contentVersion'] as String,
      curricula: (json['curricula'] as List<dynamic>)
          .map((item) => Curriculum.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
      tracks: (json['tracks'] as List<dynamic>)
          .map((item) => CourseTrack.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
      levels: (json['levels'] as List<dynamic>)
          .map((item) => CatalogLevel.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
    );
    catalog._validate();
    return catalog;
  }

  Curriculum curriculum(String id) => curricula.firstWhere(
    (item) => item.id == id,
    orElse: () => throw ArgumentError.value(id, 'id', 'Unknown curriculum'),
  );

  CourseTrack track(String id) => tracks.firstWhere(
    (item) => item.id == id,
    orElse: () => throw ArgumentError.value(id, 'id', 'Unknown track'),
  );

  CatalogLevel level(String id) => levels.firstWhere(
    (item) => item.id == id,
    orElse: () => throw ArgumentError.value(id, 'id', 'Unknown level'),
  );

  List<CourseTrack> tracksFor(String curriculumId) {
    final curriculumEntry = curriculum(curriculumId);
    final byId = {for (final track in tracks) track.id: track};
    return [for (final id in curriculumEntry.trackIds) byId[id]!]
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  List<CatalogLevel> levelsForTrack(String trackId) {
    final trackEntry = track(trackId);
    final byId = {for (final level in levels) level.id: level};
    return [for (final id in trackEntry.levelIds) byId[id]!]
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  List<CatalogLevel> levelsForCurriculum(String curriculumId) => [
    for (final track in tracksFor(curriculumId)) ...levelsForTrack(track.id),
  ];

  void _validate() {
    if (schemaVersion < 1 ||
        contentVersion.trim().isEmpty ||
        curricula.isEmpty ||
        tracks.isEmpty ||
        levels.isEmpty) {
      throw const FormatException('Invalid curriculum catalog header');
    }
    final curriculumIds = <String>{};
    final trackIds = <String>{};
    final levelIds = <String>{};
    for (final item in curricula) {
      if (!curriculumIds.add(item.id)) {
        throw FormatException('Duplicate curriculum id: ${item.id}');
      }
    }
    if (!curriculumIds.contains('nce-1997')) {
      throw const FormatException('Catalog is missing the default curriculum');
    }
    for (final item in tracks) {
      if (!trackIds.add(item.id) ||
          !curriculumIds.contains(item.curriculumId)) {
        throw FormatException('Invalid track: ${item.id}');
      }
    }
    for (final item in levels) {
      if (!levelIds.add(item.id) ||
          !curriculumIds.contains(item.curriculumId) ||
          !trackIds.contains(item.trackId) ||
          item.assetPath.trim().isEmpty) {
        throw FormatException('Invalid level: ${item.id}');
      }
      final owner = track(item.trackId);
      if (owner.curriculumId != item.curriculumId) {
        throw FormatException(
          'Level is assigned to the wrong track: ${item.id}',
        );
      }
    }
    for (final curriculumEntry in curricula) {
      if (curriculumEntry.trackIds.isEmpty) {
        throw FormatException(
          'Curriculum has no tracks: ${curriculumEntry.id}',
        );
      }
      if (curriculumEntry.trackIds.toSet().length !=
          curriculumEntry.trackIds.length) {
        throw FormatException(
          'Curriculum repeats a track: ${curriculumEntry.id}',
        );
      }
      for (final trackId in curriculumEntry.trackIds) {
        if (!trackIds.contains(trackId) ||
            track(trackId).curriculumId != curriculumEntry.id) {
          throw FormatException('Invalid curriculum track: $trackId');
        }
      }
    }
    for (final trackEntry in tracks) {
      if (trackEntry.levelIds.isEmpty) {
        throw FormatException('Track has no levels: ${trackEntry.id}');
      }
      if (trackEntry.levelIds.toSet().length != trackEntry.levelIds.length) {
        throw FormatException('Track repeats a level: ${trackEntry.id}');
      }
      for (final levelId in trackEntry.levelIds) {
        if (!levelIds.contains(levelId) ||
            level(levelId).trackId != trackEntry.id) {
          throw FormatException('Invalid track level: $levelId');
        }
      }
    }
    final referencedTrackIds = curricula
        .expand((curriculum) => curriculum.trackIds)
        .toList(growable: false);
    final referencedLevelIds = tracks
        .expand((track) => track.levelIds)
        .toList(growable: false);
    if (referencedTrackIds.length != tracks.length ||
        referencedTrackIds.toSet().length != tracks.length) {
      throw const FormatException(
        'Every track must belong to exactly one curriculum',
      );
    }
    if (referencedLevelIds.length != levels.length ||
        referencedLevelIds.toSet().length != levels.length) {
      throw const FormatException(
        'Every level must belong to exactly one track',
      );
    }
  }
}

class Curriculum {
  const Curriculum({
    required this.id,
    required this.titleEn,
    required this.titleZh,
    required this.trackIds,
  });

  final String id;
  final String titleEn;
  final String titleZh;
  final List<String> trackIds;

  factory Curriculum.fromJson(Map<String, dynamic> json) => Curriculum(
    id: json['id'] as String,
    titleEn: json['titleEn'] as String,
    titleZh: json['titleZh'] as String,
    trackIds: (json['trackIds'] as List<dynamic>).cast<String>(),
  );
}

class CourseTrack {
  const CourseTrack({
    required this.id,
    required this.curriculumId,
    required this.titleEn,
    required this.titleZh,
    required this.order,
    required this.levelIds,
  });

  final String id;
  final String curriculumId;
  final String titleEn;
  final String titleZh;
  final int order;
  final List<String> levelIds;

  factory CourseTrack.fromJson(Map<String, dynamic> json) => CourseTrack(
    id: json['id'] as String,
    curriculumId: json['curriculumId'] as String,
    titleEn: json['titleEn'] as String,
    titleZh: json['titleZh'] as String,
    order: (json['order'] as num).toInt(),
    levelIds: (json['levelIds'] as List<dynamic>).cast<String>(),
  );
}

class CatalogLevel {
  const CatalogLevel({
    required this.id,
    required this.curriculumId,
    required this.trackId,
    required this.order,
    required this.levelNumber,
    required this.rating,
    required this.assetPath,
  });

  final String id;
  final String curriculumId;
  final String trackId;
  final int order;
  final int levelNumber;
  final String rating;
  final String assetPath;

  factory CatalogLevel.fromJson(Map<String, dynamic> json) => CatalogLevel(
    id: json['id'] as String,
    curriculumId: json['curriculumId'] as String,
    trackId: json['trackId'] as String,
    order: (json['order'] as num).toInt(),
    levelNumber: (json['levelNumber'] as num).toInt(),
    rating: (json['rating'] ?? 'all-ages') as String,
    assetPath: json['assetPath'] as String,
  );
}

class VocabularySource {
  const VocabularySource._({
    required this.type,
    this.book,
    this.lesson,
    this.listId,
    this.rank,
    this.provenanceId,
  });

  const VocabularySource.nce({
    required int book,
    required int lesson,
    String? provenanceId,
  }) : this._(
         type: VocabularySourceType.nce,
         book: book,
         lesson: lesson,
         provenanceId: provenanceId,
       );

  const VocabularySource.ielts({
    required String listId,
    required int rank,
    String? provenanceId,
  }) : this._(
         type: VocabularySourceType.ielts,
         listId: listId,
         rank: rank,
         provenanceId: provenanceId,
       );

  final VocabularySourceType type;
  final int? book;
  final int? lesson;
  final String? listId;
  final int? rank;
  final String? provenanceId;

  bool get isNce => type == VocabularySourceType.nce;
  bool get isIelts => type == VocabularySourceType.ielts;

  factory VocabularySource.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String?;
    if (type == 'ielts' || json.containsKey('listId')) {
      return VocabularySource.ielts(
        listId: (json['listId'] ?? 'NAWL-1.2') as String,
        rank: (json['rank'] as num? ?? 0).toInt(),
        provenanceId: json['provenanceId'] as String?,
      );
    }
    return VocabularySource.nce(
      book: (json['book'] as num).toInt(),
      lesson: (json['lesson'] as num).toInt(),
      provenanceId: json['provenanceId'] as String?,
    );
  }
}

class TargetWord {
  const TargetWord({
    required this.id,
    required this.word,
    required this.englishClue,
    required this.chineseClue,
    required this.start,
    required this.direction,
    required this.source,
  });

  final String id;
  final String word;
  final String englishClue;
  final String chineseClue;
  final GridPoint start;
  final WordDirection direction;
  final VocabularySource source;

  int get length => word.length;

  List<GridPoint> get cells => List.generate(
    word.length,
    (index) => GridPoint(
      start.row + (direction == WordDirection.down ? index : 0),
      start.col + (direction == WordDirection.across ? index : 0),
    ),
  );

  factory TargetWord.fromJson(Map<String, dynamic> json) {
    final start = json['start'] as Map<String, dynamic>;
    return TargetWord(
      id: json['id'] as String,
      word: (json['word'] as String).toUpperCase(),
      englishClue: (json['englishMeaning'] ?? json['clue'] ?? '') as String,
      chineseClue: (json['chineseMeaning'] ?? '') as String,
      start: GridPoint(
        (start['row'] as num).toInt(),
        (start['col'] as num).toInt(),
      ),
      direction: json['direction'] == 'down'
          ? WordDirection.down
          : WordDirection.across,
      source: VocabularySource.fromJson(json['source'] as Map<String, dynamic>),
    );
  }
}

class VocabularyWord {
  const VocabularyWord({
    required this.id,
    required this.phonetic,
    required this.partOfSpeech,
    required this.example,
    required this.cefr,
    required this.rating,
  });

  final String id;
  final String phonetic;
  final String partOfSpeech;
  final String example;
  final String cefr;
  final String rating;

  factory VocabularyWord.fromJson(Map<String, dynamic> json) {
    final examples = (json['examples'] as List<dynamic>? ?? const []);
    return VocabularyWord(
      id: json['id'] as String,
      phonetic: (json['phonetic'] ?? '') as String,
      partOfSpeech: (json['partOfSpeech'] ?? '') as String,
      example: examples.isEmpty ? '' : examples.first as String,
      cefr: (json['cefrLevel'] ?? '') as String,
      rating: (json['rating'] ?? 'all-ages') as String,
    );
  }
}

class CourseLevel {
  const CourseLevel({
    required this.id,
    required this.curriculumId,
    required this.trackId,
    required this.levelNumber,
    required this.bookId,
    required this.unitId,
    required this.title,
    required this.letters,
    required this.words,
    required this.rows,
    required this.cols,
    required this.rewardCoins,
    required this.perfectBonusCoins,
    required this.layoutRevision,
  });

  final String id;
  final String curriculumId;
  final String trackId;
  final int levelNumber;
  final String bookId;
  final String unitId;
  final String title;
  final List<String> letters;
  final List<TargetWord> words;
  final int rows;
  final int cols;
  final int rewardCoins;
  final int perfectBonusCoins;
  final String layoutRevision;

  CourseLevel withCatalog(CatalogLevel entry) => CourseLevel(
    id: id,
    curriculumId: entry.curriculumId,
    trackId: entry.trackId,
    levelNumber: entry.levelNumber,
    bookId: bookId,
    unitId: unitId,
    title: title,
    letters: letters,
    words: words,
    rows: rows,
    cols: cols,
    rewardCoins: rewardCoins,
    perfectBonusCoins: perfectBonusCoins,
    layoutRevision: layoutRevision,
  );

  factory CourseLevel.fromJson(Map<String, dynamic> json) {
    final grid = json['grid'] as Map<String, dynamic>;
    final id = json['id'] as String;
    final targetWords = (json['targetWords'] as List<dynamic>)
        .map((item) => TargetWord.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
    return CourseLevel(
      id: id,
      curriculumId: (json['curriculumId'] ?? '') as String,
      trackId: (json['trackId'] ?? json['bookId'] ?? '') as String,
      levelNumber:
          (json['levelNumber'] as num?)?.toInt() ??
          int.tryParse(
            RegExp(r'level-(\d+)$').firstMatch(id)?.group(1) ?? '',
          ) ??
          0,
      bookId: (json['bookId'] ?? json['trackId'] ?? '') as String,
      unitId: (json['unitId'] ?? '') as String,
      title: (json['title'] ?? '') as String,
      letters: (json['letters'] as List<dynamic>)
          .map((item) => item as String)
          .toList(growable: false),
      words: targetWords,
      rows: (grid['rows'] as num).toInt(),
      cols: (grid['cols'] as num).toInt(),
      rewardCoins: (json['rewardCoins'] as num).toInt(),
      perfectBonusCoins: (json['perfectBonusCoins'] as num).toInt(),
      layoutRevision: (json['layoutRevision'] ?? 'layout-1') as String,
    );
  }
}

class LevelBundle {
  const LevelBundle({
    required this.contentVersion,
    required this.level,
    required this.vocabulary,
    required this.releaseStatus,
    required this.rating,
  });

  final String contentVersion;
  final CourseLevel level;
  final Map<String, VocabularyWord> vocabulary;
  final String releaseStatus;
  final String rating;

  LevelBundle withCatalog(CatalogLevel entry) => LevelBundle(
    contentVersion: contentVersion,
    level: level.withCatalog(entry),
    vocabulary: vocabulary,
    releaseStatus: releaseStatus,
    rating: rating,
  );

  factory LevelBundle.decode(String source) {
    final json = jsonDecode(source) as Map<String, dynamic>;
    final words = (json['vocabulary'] as List<dynamic>).map(
      (item) => VocabularyWord.fromJson(item as Map<String, dynamic>),
    );
    return LevelBundle(
      contentVersion: json['contentVersion'] as String,
      level: CourseLevel.fromJson(json['level'] as Map<String, dynamic>),
      vocabulary: {for (final word in words) word.id: word},
      releaseStatus: (json['releaseStatus'] ?? 'automated-beta') as String,
      rating: (json['rating'] ?? 'all-ages') as String,
    );
  }
}
