import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'data/assessment_repository.dart';
import 'data/course_repository.dart';
import 'models/assessment.dart';
import 'models/course.dart';
import 'models/player_state.dart';
import 'services/local_store.dart';
import 'services/vocabulary_assessment_engine.dart';

enum StorageStatus {
  loading,
  ready,
  recovered,
  writeFailed,
  unsupportedVersion,
  contentUnavailable,
}

class AppController extends ChangeNotifier {
  AppController({
    CourseRepository? repository,
    AssessmentRepository? assessmentRepository,
    LocalStore? store,
  }) : repository = repository ?? CourseRepository(),
       assessmentRepository = assessmentRepository ?? AssessmentRepository(),
       _store = store ?? LocalStore();

  static const storageVersion = 5;
  static const defaultCurriculumId = 'nce-1997';

  final CourseRepository repository;
  final AssessmentRepository assessmentRepository;
  final LocalStore _store;
  AssessmentBank? _assessmentBank;
  VocabularyAssessmentEngine? _assessmentEngine;
  bool _assessmentPaused = false;

  StorageStatus storageStatus = StorageStatus.loading;
  Map<String, PlayerProfile> _profiles = {};
  String? _activeProfileId;

  bool get isReady => storageStatus != StorageStatus.loading;
  bool get hasProfile => activeProfile != null;
  bool get needsGettingStarted =>
      activeProfile != null && !activeProfile!.hasSeenGettingStarted;
  List<PlayerProfile> get profiles => _profiles.values.toList(growable: false);
  PlayerProfile? get activeProfile => _profiles[_activeProfileId];
  AssessmentSession? get activeAssessmentSession =>
      activeProfile?.activeAssessmentSession;
  List<AssessmentSession> get assessmentHistory =>
      activeProfile?.assessmentHistory ?? const <AssessmentSession>[];
  AssessmentSession? get latestAssessmentResult =>
      assessmentHistory.isEmpty ? null : assessmentHistory.first;
  bool get isAssessmentPaused => _assessmentPaused;
  bool get isAssessmentAvailable => _assessmentBank != null;
  AssessmentQuestion? get currentAssessmentQuestion {
    final session = activeAssessmentSession;
    final engine = _assessmentEngine;
    if (session == null || session.isComplete || engine == null) return null;
    return engine.nextQuestion(session);
  }

  CurriculumCatalog get catalog => repository.catalog!;
  String get contentVersion => catalog.contentVersion;

  Curriculum get activeCurriculum {
    final requested = activeProfile?.activeCurriculumId ?? defaultCurriculumId;
    return catalog.curricula.firstWhere(
      (item) => item.id == requested,
      orElse: () => catalog.curricula.first,
    );
  }

  List<CourseTrack> get activeTracks => catalog.tracksFor(activeCurriculum.id);

  Future<void> initialize() async {
    try {
      await Future.wait([
        repository.loadCatalog(),
        assessmentRepository.loadBank().then((bank) {
          _assessmentBank = bank;
        }),
      ]);
    } catch (_) {
      storageStatus = StorageStatus.contentUnavailable;
      notifyListeners();
      return;
    }

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
      if (version != 3 && version != 4 && version != storageVersion) {
        throw const FormatException('Unsupported legacy Flutter save');
      }
      final rawProfiles = json['profiles'] as Map<String, dynamic>? ?? const {};
      _profiles = rawProfiles.map((key, value) {
        final parsed = PlayerProfile.fromJson(value as Map<String, dynamic>);
        final curriculumId =
            catalog.curricula.any(
              (item) => item.id == parsed.activeCurriculumId,
            )
            ? parsed.activeCurriculumId
            : defaultCurriculumId;
        return MapEntry(
          key,
          PlayerProfile(
            id: key,
            nickname: parsed.nickname,
            ageBand: parsed.ageBand,
            uiLanguage: parsed.uiLanguage,
            clueLanguage: parsed.clueLanguage,
            createdAt: parsed.createdAt,
            activeCurriculumId: curriculumId,
            hasSeenGettingStarted: parsed.hasSeenGettingStarted,
            coins: parsed.coins,
            levels: parsed.levels,
            review: parsed.review,
            activeDates: parsed.activeDates,
            activeAssessmentSession:
                parsed.activeAssessmentSession?.bankVersion ==
                    _assessmentBank!.bankVersion
                ? parsed.activeAssessmentSession
                : null,
            assessmentHistory: parsed.assessmentHistory,
          ),
        );
      });
      final requestedActive = json['activeProfileId'] as String?;
      _activeProfileId = _profiles.containsKey(requestedActive)
          ? requestedActive
          : (_profiles.isEmpty ? null : _profiles.keys.first);
      storageStatus = StorageStatus.ready;
      _rebuildAssessmentEngine();
      if (version != storageVersion) unawaited(_persist());
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
        hasSeenGettingStarted: false,
      ),
    };
    _activeProfileId = id;
    storageStatus = StorageStatus.ready;
    _commit();
  }

  void switchProfile(String id) {
    if (!_profiles.containsKey(id) || id == _activeProfileId) return;
    _activeProfileId = id;
    _assessmentPaused = false;
    _rebuildAssessmentEngine();
    _commit();
  }

  void selectCurriculum(String curriculumId) {
    final profile = activeProfile;
    if (profile == null || profile.activeCurriculumId == curriculumId) return;
    catalog.curriculum(curriculumId);
    _replaceActive(profile.copyWith(activeCurriculumId: curriculumId));
  }

  void completeGettingStarted() {
    final profile = activeProfile;
    if (profile == null || profile.hasSeenGettingStarted) return;
    _replaceActive(profile.copyWith(hasSeenGettingStarted: true));
  }

  Future<void> startAssessment(AssessmentAnchor anchor) async {
    final profile = activeProfile;
    if (profile == null) return;
    final bank = _assessmentBank ?? await assessmentRepository.loadBank();
    _assessmentBank = bank;
    final startedAt = DateTime.now();
    _assessmentEngine = VocabularyAssessmentEngine(
      bank: bank,
      seed: startedAt.microsecondsSinceEpoch,
      previouslyExposedLemmaIds: _previouslyExposedLemmaIds(bank),
    );
    _assessmentPaused = false;
    _replaceActive(
      profile.copyWith(
        activeAssessmentSession: _assessmentEngine!.start(
          anchor,
          startedAt: startedAt,
        ),
      ),
    );
  }

  AssessmentStep submitAssessmentAnswer(AssessmentAnswer answer) {
    final profile = activeProfile;
    final session = profile?.activeAssessmentSession;
    final engine = _assessmentEngine;
    final question = currentAssessmentQuestion;
    if (profile == null ||
        session == null ||
        engine == null ||
        question == null) {
      throw StateError('No active assessment question');
    }
    final step = engine.submit(session, question, answer);
    if (step.session.isComplete) {
      _replaceActive(
        profile.copyWith(
          clearActiveAssessmentSession: true,
          assessmentHistory: <AssessmentSession>[
            step.session,
            ...profile.assessmentHistory,
          ].take(10).toList(growable: false),
        ),
      );
    } else {
      _replaceActive(profile.copyWith(activeAssessmentSession: step.session));
    }
    return step;
  }

  void pauseAssessment() {
    if (activeAssessmentSession == null || _assessmentPaused) return;
    _assessmentPaused = true;
    _commit();
  }

  void resumeAssessment() {
    if (activeAssessmentSession == null || !_assessmentPaused) return;
    _assessmentPaused = false;
    notifyListeners();
  }

  void abandonAssessment() {
    final profile = activeProfile;
    if (profile?.activeAssessmentSession == null) return;
    _assessmentPaused = false;
    _replaceActive(profile!.copyWith(clearActiveAssessmentSession: true));
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

  int completedInCurriculum(String curriculumId) {
    final ids = catalog
        .levelsForCurriculum(curriculumId)
        .map((entry) => entry.id)
        .toSet();
    return activeProfile?.levels.entries
            .where((entry) => ids.contains(entry.key) && entry.value.completed)
            .length ??
        0;
  }

  int completedInTrack(String trackId) {
    final ids = catalog
        .levelsForTrack(trackId)
        .map((entry) => entry.id)
        .toSet();
    return activeProfile?.levels.entries
            .where((entry) => ids.contains(entry.key) && entry.value.completed)
            .length ??
        0;
  }

  int completedInBook(int book) => completedInTrack('nce-1997-b$book');

  int get dueReviewCount {
    final now = DateTime.now();
    return activeProfile?.review.values
            .where((item) => item.isDue(now) && _canReview(item))
            .length ??
        0;
  }

  List<ReviewDebt> get dueReviewItems {
    final now = DateTime.now();
    final items =
        activeProfile?.review.values
            .where((item) => item.isDue(now) && _canReview(item))
            .toList(growable: false) ??
        [];
    items.sort((a, b) => a.dueAt.compareTo(b.dueAt));
    return items;
  }

  List<CatalogLevel> accessibleLevelsFor(String curriculumId) => catalog
      .levelsForCurriculum(curriculumId)
      .where((entry) => canAccessLevel(entry.id))
      .toList(growable: false);

  String get continueLevelId {
    final levels = accessibleLevelsFor(activeCurriculum.id);
    if (levels.isEmpty) {
      throw StateError('No accessible levels in ${activeCurriculum.id}');
    }
    final profile = activeProfile;
    return levels
        .firstWhere(
          (entry) => !(profile?.levels[entry.id]?.completed ?? false),
          orElse: () => levels.last,
        )
        .id;
  }

  bool canAccessBook(int book) =>
      book <= (activeProfile?.ageBand.maxBook ?? AgeBand.allAges.maxBook);

  bool canAccessTrack(String trackId) {
    final track = catalog.track(trackId);
    if (track.curriculumId != defaultCurriculumId) return true;
    return track.order <=
        (activeProfile?.ageBand.maxBook ?? AgeBand.allAges.maxBook);
  }

  bool canAccessLevel(String id) {
    final entry = catalog.level(id);
    return canAccessTrack(entry.trackId) &&
        (activeProfile?.ageBand ?? AgeBand.allAges).canAccessRating(
          entry.rating,
        );
  }

  String? nextLevelId(CourseLevel level) {
    final levels = catalog.levelsForCurriculum(level.curriculumId);
    final index = levels.indexWhere((entry) => entry.id == level.id);
    if (index < 0) return null;
    for (final entry in levels.skip(index + 1)) {
      if (canAccessLevel(entry.id)) return entry.id;
    }
    return null;
  }

  bool _canReview(ReviewDebt item) {
    try {
      return canAccessLevel(item.levelId);
    } on ArgumentError {
      return false;
    }
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
        activeCurriculumId: profile.activeCurriculumId,
        hasSeenGettingStarted: profile.hasSeenGettingStarted,
      ),
    );
  }

  void _replaceActive(PlayerProfile profile) {
    _profiles = {..._profiles, profile.id: profile};
    _commit();
  }

  void _rebuildAssessmentEngine() {
    final bank = _assessmentBank;
    final session = activeAssessmentSession;
    if (bank == null || session == null) {
      _assessmentEngine = null;
      return;
    }
    _assessmentEngine = VocabularyAssessmentEngine(
      bank: bank,
      seed: session.startedAt.microsecondsSinceEpoch,
      previouslyExposedLemmaIds: _previouslyExposedLemmaIds(bank),
    );
  }

  Set<String> _previouslyExposedLemmaIds(AssessmentBank bank) {
    final wordIds =
        activeProfile?.levels.entries
            .expand((entry) => entry.value.solvedWordIds)
            .toSet() ??
        const <String>{};
    return bank.realItems
        .where(
          (item) => wordIds.any(
            (wordId) =>
                wordId.endsWith('-${item.spelling}') ||
                wordId.contains('-${item.spelling}-'),
          ),
        )
        .map((item) => item.lemmaId)
        .toSet();
  }

  void _commit() {
    notifyListeners();
    if (storageStatus == StorageStatus.unsupportedVersion) return;
    unawaited(_persist());
  }

  Future<void> _persist() async {
    final result = await _store.write(
      jsonEncode({
        'storageVersion': storageVersion,
        'contentVersion': contentVersion,
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
