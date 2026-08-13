import 'assessment.dart';

enum UiLanguage { english, chinese }

enum AgeBand { allAges, sevenToNine, tenToTwelve, thirteenToFifteen }

extension UiLanguageValue on UiLanguage {
  String get value => this == UiLanguage.english ? 'en' : 'zh-CN';

  static UiLanguage parse(Object? value) =>
      value == 'zh-CN' ? UiLanguage.chinese : UiLanguage.english;
}

extension AgeBandValue on AgeBand {
  String get value => switch (this) {
    AgeBand.allAges => '3+',
    AgeBand.sevenToNine => '7-9',
    AgeBand.tenToTwelve => '10-12',
    AgeBand.thirteenToFifteen => '13-15',
  };

  int get maxBook => switch (this) {
    AgeBand.allAges => 4,
    AgeBand.sevenToNine => 1,
    AgeBand.tenToTwelve => 2,
    AgeBand.thirteenToFifteen => 4,
  };

  bool canAccessRating(String rating) => switch (rating) {
    'all-ages' => true,
    '13-plus' => this == AgeBand.thirteenToFifteen,
    _ => false,
  };

  static AgeBand parse(Object? value) => switch (value) {
    '3+' => AgeBand.allAges,
    '7-9' => AgeBand.sevenToNine,
    '10-12' => AgeBand.tenToTwelve,
    '13-15' => AgeBand.thirteenToFifteen,
    _ => AgeBand.allAges,
  };
}

class LevelProgress {
  const LevelProgress({
    this.solvedWordIds = const <String>{},
    this.completed = false,
    this.rewardClaimed = false,
    this.bestStars = 0,
    this.attemptCount = 0,
    this.wrongAttempts = 0,
    this.hintCount = 0,
    this.firstTryCorrect = 0,
  });

  final Set<String> solvedWordIds;
  final bool completed;
  final bool rewardClaimed;
  final int bestStars;
  final int attemptCount;
  final int wrongAttempts;
  final int hintCount;
  final int firstTryCorrect;

  LevelProgress copyWith({
    Set<String>? solvedWordIds,
    bool? completed,
    bool? rewardClaimed,
    int? bestStars,
    int? attemptCount,
    int? wrongAttempts,
    int? hintCount,
    int? firstTryCorrect,
  }) => LevelProgress(
    solvedWordIds: solvedWordIds ?? this.solvedWordIds,
    completed: completed ?? this.completed,
    rewardClaimed: rewardClaimed ?? this.rewardClaimed,
    bestStars: bestStars ?? this.bestStars,
    attemptCount: attemptCount ?? this.attemptCount,
    wrongAttempts: wrongAttempts ?? this.wrongAttempts,
    hintCount: hintCount ?? this.hintCount,
    firstTryCorrect: firstTryCorrect ?? this.firstTryCorrect,
  );

  Map<String, dynamic> toJson() => {
    'solvedWordIds': solvedWordIds.toList(),
    'completed': completed,
    'rewardClaimed': rewardClaimed,
    'bestStars': bestStars,
    'attemptCount': attemptCount,
    'wrongAttempts': wrongAttempts,
    'hintCount': hintCount,
    'firstTryCorrect': firstTryCorrect,
  };

  factory LevelProgress.fromJson(Map<String, dynamic> json) => LevelProgress(
    solvedWordIds: (json['solvedWordIds'] as List<dynamic>? ?? const [])
        .whereType<String>()
        .toSet(),
    completed: json['completed'] == true,
    rewardClaimed: json['rewardClaimed'] == true,
    bestStars: (json['bestStars'] as num? ?? 0).toInt().clamp(0, 3),
    attemptCount: (json['attemptCount'] as num? ?? 0).toInt().clamp(0, 99999),
    wrongAttempts: (json['wrongAttempts'] as num? ?? 0).toInt().clamp(0, 99999),
    hintCount: (json['hintCount'] as num? ?? 0).toInt().clamp(0, 99999),
    firstTryCorrect: (json['firstTryCorrect'] as num? ?? 0).toInt().clamp(
      0,
      99999,
    ),
  );
}

class ReviewDebt {
  const ReviewDebt({
    required this.wordId,
    required this.levelId,
    required this.dueAt,
    this.wrongCount = 0,
    this.hintCount = 0,
  });

  final String wordId;
  final String levelId;
  final DateTime dueAt;
  final int wrongCount;
  final int hintCount;

  bool isDue(DateTime now) => !dueAt.isAfter(now);

  Map<String, dynamic> toJson() => {
    'wordId': wordId,
    'levelId': levelId,
    'dueAt': dueAt.toUtc().toIso8601String(),
    'wrongCount': wrongCount,
    'hintCount': hintCount,
  };

  factory ReviewDebt.fromJson(Map<String, dynamic> json) => ReviewDebt(
    wordId: json['wordId'] as String,
    levelId: json['levelId'] as String,
    dueAt:
        DateTime.tryParse(json['dueAt'] as String? ?? '')?.toLocal() ??
        DateTime.now(),
    wrongCount: (json['wrongCount'] as num? ?? 0).toInt().clamp(0, 99999),
    hintCount: (json['hintCount'] as num? ?? 0).toInt().clamp(0, 99999),
  );
}

class PlayerProfile {
  const PlayerProfile({
    required this.id,
    required this.nickname,
    required this.ageBand,
    required this.uiLanguage,
    required this.clueLanguage,
    required this.createdAt,
    this.activeCurriculumId = 'nce-1997',
    this.hasSeenGettingStarted = true,
    this.coins = 0,
    this.levels = const {},
    this.review = const {},
    this.activeDates = const <String>{},
    this.activeAssessmentSession,
    this.assessmentHistory = const <AssessmentSession>[],
  });

  final String id;
  final String nickname;
  final AgeBand ageBand;
  final UiLanguage uiLanguage;
  final UiLanguage clueLanguage;
  final DateTime createdAt;
  final String activeCurriculumId;
  final bool hasSeenGettingStarted;
  final int coins;
  final Map<String, LevelProgress> levels;
  final Map<String, ReviewDebt> review;
  final Set<String> activeDates;
  final AssessmentSession? activeAssessmentSession;
  final List<AssessmentSession> assessmentHistory;

  PlayerProfile copyWith({
    String? nickname,
    AgeBand? ageBand,
    UiLanguage? uiLanguage,
    UiLanguage? clueLanguage,
    String? activeCurriculumId,
    bool? hasSeenGettingStarted,
    int? coins,
    Map<String, LevelProgress>? levels,
    Map<String, ReviewDebt>? review,
    Set<String>? activeDates,
    AssessmentSession? activeAssessmentSession,
    bool clearActiveAssessmentSession = false,
    List<AssessmentSession>? assessmentHistory,
  }) => PlayerProfile(
    id: id,
    nickname: nickname ?? this.nickname,
    ageBand: ageBand ?? this.ageBand,
    uiLanguage: uiLanguage ?? this.uiLanguage,
    clueLanguage: clueLanguage ?? this.clueLanguage,
    createdAt: createdAt,
    activeCurriculumId: activeCurriculumId ?? this.activeCurriculumId,
    hasSeenGettingStarted: hasSeenGettingStarted ?? this.hasSeenGettingStarted,
    coins: coins ?? this.coins,
    levels: levels ?? this.levels,
    review: review ?? this.review,
    activeDates: activeDates ?? this.activeDates,
    activeAssessmentSession: clearActiveAssessmentSession
        ? null
        : activeAssessmentSession ?? this.activeAssessmentSession,
    assessmentHistory: assessmentHistory ?? this.assessmentHistory,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'nickname': nickname,
    'ageBand': ageBand.value,
    'uiLanguage': uiLanguage.value,
    'clueLanguage': clueLanguage.value,
    'createdAt': createdAt.toUtc().toIso8601String(),
    'activeCurriculumId': activeCurriculumId,
    'hasSeenGettingStarted': hasSeenGettingStarted,
    'coins': coins,
    'levels': levels.map((key, value) => MapEntry(key, value.toJson())),
    'review': review.map((key, value) => MapEntry(key, value.toJson())),
    'activeDates': activeDates.toList(),
    'activeAssessmentSession': activeAssessmentSession?.toJson(),
    'assessmentHistory': assessmentHistory
        .take(10)
        .map((session) => session.toJson())
        .toList(),
  };

  factory PlayerProfile.fromJson(Map<String, dynamic> json) {
    final rawLevels = json['levels'] as Map<String, dynamic>? ?? const {};
    final rawReview = json['review'] as Map<String, dynamic>? ?? const {};
    return PlayerProfile(
      id: (json['id'] as String?)?.trim().isNotEmpty == true
          ? json['id'] as String
          : 'recovered-profile',
      nickname: (json['nickname'] as String?)?.trim().isNotEmpty == true
          ? json['nickname'] as String
          : 'Explorer',
      ageBand: AgeBandValue.parse(json['ageBand']),
      uiLanguage: UiLanguageValue.parse(json['uiLanguage']),
      clueLanguage: UiLanguageValue.parse(json['clueLanguage']),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
          DateTime.now(),
      activeCurriculumId:
          (json['activeCurriculumId'] as String?)?.trim().isNotEmpty == true
          ? json['activeCurriculumId'] as String
          : 'nce-1997',
      hasSeenGettingStarted: json.containsKey('hasSeenGettingStarted')
          ? json['hasSeenGettingStarted'] == true
          : true,
      coins: (json['coins'] as num? ?? 0).toInt().clamp(0, 999999999),
      levels: rawLevels.map(
        (key, value) => MapEntry(
          key,
          LevelProgress.fromJson(value as Map<String, dynamic>),
        ),
      ),
      review: rawReview.map(
        (key, value) =>
            MapEntry(key, ReviewDebt.fromJson(value as Map<String, dynamic>)),
      ),
      activeDates: (json['activeDates'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toSet(),
      activeAssessmentSession: _parseAssessmentSession(
        json['activeAssessmentSession'],
        requireComplete: false,
      ),
      assessmentHistory:
          (json['assessmentHistory'] as List<dynamic>? ?? const [])
              .map(
                (value) =>
                    _parseAssessmentSession(value, requireComplete: true),
              )
              .whereType<AssessmentSession>()
              .take(10)
              .toList(growable: false),
    );
  }
}

AssessmentSession? _parseAssessmentSession(
  Object? value, {
  required bool requireComplete,
}) {
  if (value is! Map<String, dynamic>) return null;
  try {
    final session = AssessmentSession.fromJson(value);
    if (session.isComplete != requireComplete) return null;
    return session;
  } catch (_) {
    return null;
  }
}
