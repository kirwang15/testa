import 'package:flutter/services.dart';

import '../models/course.dart';

class CourseRepository {
  final Map<String, LevelBundle> _cache = {};

  static String levelId(int book, int level) =>
      'nce-1997-b$book-level-${level.toString().padLeft(3, '0')}';

  Future<LevelBundle> loadLevel(String id) async {
    final cached = _cache[id];
    if (cached != null) return cached;
    if (!RegExp(r'^nce-1997-b[1-4]-level-\d{3}$').hasMatch(id)) {
      throw ArgumentError.value(id, 'id', 'Unsupported course level');
    }
    final source = await rootBundle.loadString(
      'assets/content/levels/$id.json',
    );
    final bundle = LevelBundle.decode(source);
    if (bundle.level.id != id) {
      throw const FormatException(
        'Level asset id does not match its file name',
      );
    }
    _cache[id] = bundle;
    return bundle;
  }

  List<String> levelIdsForBook(int book) =>
      List.generate(50, (index) => levelId(book, index + 1));

  List<String> levelIdsThroughBook(int maxBook) => [
    for (var book = 1; book <= maxBook; book++) ...levelIdsForBook(book),
  ];
}
