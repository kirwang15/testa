import 'package:flutter/services.dart';

import '../models/course.dart';

class CourseRepository {
  CourseRepository({
    AssetBundle? assetBundle,
    this.catalogPath = 'assets/content/catalog.json',
  }) : _assetBundle = assetBundle ?? rootBundle;

  final AssetBundle _assetBundle;
  final String catalogPath;
  final Map<String, LevelBundle> _levelCache = {};
  Future<CurriculumCatalog>? _catalogFuture;
  CurriculumCatalog? _catalog;

  CurriculumCatalog? get catalog => _catalog;

  static String levelId(int book, int level) =>
      'nce-1997-b$book-level-${level.toString().padLeft(3, '0')}';

  Future<CurriculumCatalog> loadCatalog() => _catalogFuture ??= _loadCatalog();

  Future<CurriculumCatalog> _loadCatalog() async {
    final source = await _assetBundle.loadString(catalogPath);
    final parsed = CurriculumCatalog.decode(source);
    _catalog = parsed;
    return parsed;
  }

  Future<LevelBundle> loadLevel(String id) async {
    final cached = _levelCache[id];
    if (cached != null) return cached;
    final catalog = await loadCatalog();
    final entry = catalog.level(id);
    final source = await _assetBundle.loadString(entry.assetPath);
    final decoded = LevelBundle.decode(source);
    if (decoded.contentVersion != catalog.contentVersion) {
      throw const FormatException(
        'Level asset content version does not match catalog',
      );
    }
    if (decoded.level.id != id) {
      throw const FormatException('Level asset id does not match catalog id');
    }
    final bundle = decoded.withCatalog(entry);
    _levelCache[id] = bundle;
    return bundle;
  }

  List<String> levelIdsForBook(int book) {
    final loaded = _requireCatalog();
    return loaded
        .levelsForTrack('nce-1997-b$book')
        .map((entry) => entry.id)
        .toList(growable: false);
  }

  List<String> levelIdsThroughBook(int maxBook) => [
    for (var book = 1; book <= maxBook; book++) ...levelIdsForBook(book),
  ];

  CurriculumCatalog _requireCatalog() {
    final loaded = _catalog;
    if (loaded == null) {
      throw StateError('Course catalog has not been loaded');
    }
    return loaded;
  }
}
