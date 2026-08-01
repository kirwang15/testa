import 'dart:convert';

enum WordDirection { across, down }

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

class VocabularySource {
  const VocabularySource({required this.book, required this.lesson});

  final int book;
  final int lesson;

  factory VocabularySource.fromJson(Map<String, dynamic> json) =>
      VocabularySource(
        book: (json['book'] as num).toInt(),
        lesson: (json['lesson'] as num).toInt(),
      );
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

  int get bookNumber => int.parse(RegExp(r'-b(\d)-').firstMatch(id)!.group(1)!);
  int get levelNumber =>
      int.parse(RegExp(r'level-(\d+)').firstMatch(id)!.group(1)!);

  factory CourseLevel.fromJson(Map<String, dynamic> json) {
    final grid = json['grid'] as Map<String, dynamic>;
    return CourseLevel(
      id: json['id'] as String,
      bookId: json['bookId'] as String,
      unitId: json['unitId'] as String,
      title: json['title'] as String,
      letters: (json['letters'] as List<dynamic>)
          .map((item) => item as String)
          .toList(growable: false),
      words: (json['targetWords'] as List<dynamic>)
          .map((item) => TargetWord.fromJson(item as Map<String, dynamic>))
          .toList(growable: false),
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
