import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'data/course_repository.dart';
import 'models/course.dart';
import 'models/player_state.dart';
import 'services/local_store.dart';

enum StorageStatus {
  loading,
  ready,
  recovered,
  writeFailed,
  unsupportedVersion,
}

class AppController extends ChangeNotifier {
  AppController({CourseRepository? repository, LocalStore? store})
    : repository = repository ?? CourseRepository(),
      _store = store ?? LocalStore();

  static const storageVersion = 3;
  final CourseRepository repository;
  final LocalStore _store;

  StorageStatus storageStatus = StorageStatus.loading;
  Map<String, PlayerProfile> _profiles = {};
  String? _activeProfileId;

  bool get isReady => storageStatus != StorageStatus.loading;
  bool get hasProfile => activeProfile != null;
  List<PlayerProfile> get profiles => _profiles.values.toList(growable: false);
  PlayerProfile? get activeProfile => _profiles[_activeProfileId];

  Future<void> initialize() async {
    final raw = await _store.read();
    if (raw == null || raw.trim().isEmpty) {
      storageStatus = StorageStatus.ready;
      notifyListeners();
      return;
    }
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final version = (json['storageVersion'] as num? ?? 0).toInt();
      if (version > storageVersion) {
        await _store.preserveFutureSave(raw);
        storageStatus = StorageStatus.unsupportedVersion;
        notifyListeners();
        return;
      }
      if (version != storageVersion) {
        throw const FormatException('Unsupported legacy Flutter save');
      }
      final rawProfiles = json['profiles'] as Map<String, dynamic>? ?? const {};
      _profiles = rawProfiles.map((key, value) {
        final parsed = PlayerProfile.fromJson(value as Map<String, dynamic>);
        return MapEntry(
          key,
          parsed.id == key
              ? parsed
              : PlayerProfile(
                  id: key,
                  nickname: parsed.nickname,
                  ageBand: parsed.ageBand,
                  uiLanguage: parsed.uiLanguage,
                  clueLanguage: parsed.clueLanguage,
                  createdAt: parsed.createdAt,
                  coins: parsed.coins,
                  levels: parsed.levels,
                  review: parsed.review,
                  activeDates: parsed.activeDates,
                ),
        );
      });
      final requestedActive = json['activeProfileId'] as String?;
      _activeProfileId = _profiles.containsKey(requestedActive)
          ? requestedActive
          : (_profiles.isEmpty ? null : _profiles.keys.first);
      storageStatus = StorageStatus.ready;
    } catch (_) {
      _profiles = {};
      _activeProfileId = null;
      storageStatus = StorageStatus.recovered;
    }
    notifyListeners();
  }

  void createProfile({
    required String nickname,
    required AgeBand ageBand,
    required UiLanguage uiLanguage,
  }) {
    final now = DateTime.now();
    final id = 'profile-${now.microsecondsSinceEpoch}';
    final cleanNickname = nickname.trim().isEmpty
        ? 'Explorer'
        : nickname.trim();
    _profiles = {
      ..._profiles,
      id: PlayerProfile(
        id: id,
        nickname: cleanNickname.substring(0, cleanNickname.length.clamp(0, 18)),
        ageBand: ageBand,
        uiLanguage: uiLanguage,
        clueLanguage: UiLanguage.english,
        createdAt: now,
      ),
    };
    _activeProfileId = id;
    storageStatus = StorageStatus.ready;
    _commit();
  }

  void switchProfile(String id) {
    if (!_profiles.containsKey(id) || id == _activeProfileId) return;
    _activeProfileId = id;
    _commit();
  }

  void updatePreferences({
    UiLanguage? uiLanguage,
    UiLanguage? clueLanguage,
    AgeBand? ageBand,
  }) {
    final profile = activeProfile;
    if (profile == null) return;
    _replaceActive(
      profile.copyWith(
        uiLanguage: uiLanguage,
        clueLanguage: clueLanguage,
        ageBand: ageBand,
      ),
    );
  }

  LevelProgress progressFor(String levelId) =>
      activeProfile?.levels[levelId] ?? const LevelProgress();

  int get completedLevelCount =>
      activeProfile?.levels.values.where((item) => item.completed).length ?? 0;

  int completedInBook(int book) =>
      activeProfile?.levels.entries
          .where(
            (entry) =>
                entry.key.startsWith('nce-1997-b$book-') &&
                entry.value.completed,
          )
          .length ??
      0;

  int get dueReviewCount {
    final now = DateTime.now();
    return activeProfile?.review.values
            .where((item) => item.isDue(now))
            .length ??
        0;
  }

  List<ReviewDebt> get dueReviewItems {
    final now = DateTime.now();
    final items =
        activeProfile?.review.values
            .where((item) => item.isDue(now))
            .toList(growable: false) ??
        [];
    items.sort((a, b) => a.dueAt.compareTo(b.dueAt));
    return items;
  }

  String get continueLevelId {
    final profile = activeProfile;
    final maxBook = profile?.ageBand.maxBook ?? 1;
    return repository
        .levelIdsThroughBook(maxBook)
        .firstWhere(
          (id) => !(profile?.levels[id]?.completed ?? false),
          orElse: () => CourseRepository.levelId(maxBook, 50),
        );
  }

  bool canAccessBook(int book) => book <= (activeProfile?.ageBand.maxBook ?? 1);

  bool canAccessLevel(String id) {
    final match = RegExp(r'-b(\d)-').firstMatch(id);
    return match != null && canAccessBook(int.parse(match.group(1)!));
  }

  String? nextLevelId(CourseLevel level) {
    if (level.levelNumber < 50) {
      return CourseRepository.levelId(level.bookNumber, level.levelNumber + 1);
    }
    if (level.bookNumber < (activeProfile?.ageBand.maxBook ?? 1)) {
      return CourseRepository.levelId(level.bookNumber + 1, 1);
    }
    return null;
  }

  void beginAttempt(String levelId) {
    final profile = activeProfile;
    if (profile == null) return;
    final levels = Map<String, LevelProgress>.of(profile.levels);
    final current = levels[levelId] ?? const LevelProgress();
    levels[levelId] = current.copyWith(attemptCount: current.attemptCount + 1);
    _replaceActive(
      profile.copyWith(
        levels: levels,
        activeDates: {...profile.activeDates, _dayKey(DateTime.now())},
      ),
    );
  }

  void recordCorrect({
    required String levelId,
    required String wordId,
    required bool firstTry,
  }) {
    final profile = activeProfile;
    if (profile == null) return;
    final levels = Map<String, LevelProgress>.of(profile.levels);
    final current = levels[levelId] ?? const LevelProgress();
    final wasSolved = current.solvedWordIds.contains(wordId);
    levels[levelId] = current.copyWith(
      solvedWordIds: {...current.solvedWordIds, wordId},
      firstTryCorrect:
          current.firstTryCorrect + (!wasSolved && firstTry ? 1 : 0),
    );
    _replaceActive(profile.copyWith(levels: levels));
  }

  void recordWrong({required String levelId, required String wordId}) {
    final profile = activeProfile;
    if (profile == null) return;
    final levels = Map<String, LevelProgress>.of(profile.levels);
    final current = levels[levelId] ?? const LevelProgress();
    levels[levelId] = current.copyWith(
      wrongAttempts: current.wrongAttempts + 1,
    );
    final review = Map<String, ReviewDebt>.of(profile.review);
    final previous = review[wordId];
    review[wordId] = ReviewDebt(
      wordId: wordId,
      levelId: levelId,
      dueAt: DateTime.now().add(const Duration(days: 1)),
      wrongCount: (previous?.wrongCount ?? 0) + 1,
      hintCount: previous?.hintCount ?? 0,
    );
    _replaceActive(profile.copyWith(levels: levels, review: review));
  }

  void recordHint({required String levelId, required String wordId}) {
    final profile = activeProfile;
    if (profile == null) return;
    final levels = Map<String, LevelProgress>.of(profile.levels);
    final current = levels[levelId] ?? const LevelProgress();
    levels[levelId] = current.copyWith(hintCount: current.hintCount + 1);
    final review = Map<String, ReviewDebt>.of(profile.review);
    final previous = review[wordId];
    review[wordId] = ReviewDebt(
      wordId: wordId,
      levelId: levelId,
      dueAt: previous?.dueAt ?? DateTime.now().add(const Duration(days: 1)),
      wrongCount: previous?.wrongCount ?? 0,
      hintCount: (previous?.hintCount ?? 0) + 1,
    );
    _replaceActive(profile.copyWith(levels: levels, review: review));
  }

  void completeLevel(CourseLevel level) {
    final profile = activeProfile;
    if (profile == null) return;
    final levels = Map<String, LevelProgress>.of(profile.levels);
    final current = levels[level.id] ?? const LevelProgress();
    final stars =
        1 +
        (current.hintCount == 0 ? 1 : 0) +
        (current.wrongAttempts == 0 ? 1 : 0);
    final earnsReward = !current.rewardClaimed;
    levels[level.id] = current.copyWith(
      completed: true,
      rewardClaimed: true,
      bestStars: current.bestStars > stars ? current.bestStars : stars,
    );
    _replaceActive(
      profile.copyWith(
        levels: levels,
        coins:
            profile.coins +
            (earnsReward
                ? level.rewardCoins + (stars == 3 ? level.perfectBonusCoins : 0)
                : 0),
      ),
    );
  }

  void completeReview(String wordId) {
    final profile = activeProfile;
    if (profile == null || !profile.review.containsKey(wordId)) return;
    final review = Map<String, ReviewDebt>.of(profile.review)..remove(wordId);
    _replaceActive(profile.copyWith(review: review));
  }

  Future<void> resetActiveProfile() async {
    final profile = activeProfile;
    if (profile == null) return;
    _replaceActive(
      PlayerProfile(
        id: profile.id,
        nickname: profile.nickname,
        ageBand: profile.ageBand,
        uiLanguage: profile.uiLanguage,
        clueLanguage: profile.clueLanguage,
        createdAt: profile.createdAt,
      ),
    );
  }

  void _replaceActive(PlayerProfile profile) {
    _profiles = {..._profiles, profile.id: profile};
    _commit();
  }

  void _commit() {
    notifyListeners();
    unawaited(_persist());
  }

  Future<void> _persist() async {
    final result = await _store.write(
      jsonEncode({
        'storageVersion': storageVersion,
        'contentVersion': 'nce-1997-flutter-v1',
        'activeProfileId': _activeProfileId,
        'profiles': _profiles.map(
          (key, value) => MapEntry(key, value.toJson()),
        ),
      }),
    );
    if (!result && storageStatus != StorageStatus.writeFailed) {
      storageStatus = StorageStatus.writeFailed;
      notifyListeners();
    } else if (result && storageStatus == StorageStatus.writeFailed) {
      storageStatus = StorageStatus.ready;
      notifyListeners();
    }
  }

  static String _dayKey(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}
