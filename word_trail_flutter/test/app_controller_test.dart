import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/app_controller.dart';
import 'package:word_trail_app/models/assessment.dart';
import 'package:word_trail_app/models/player_state.dart';
import 'package:word_trail_app/services/local_store.dart';

import 'support/test_course_data.dart';

class MemoryStore extends LocalStore {
  MemoryStore([this.value]);
  String? value;
  String? futureBackup;
  bool failWrites = false;

  @override
  Future<String?> read() async => value;

  @override
  Future<bool> write(String value) async {
    if (failWrites) return false;
    this.value = value;
    return true;
  }

  @override
  Future<void> preserveFutureSave(String value) async {
    futureBackup = value;
  }
}

AppController testController([MemoryStore? store]) => AppController(
  repository: testCourseRepository(),
  store: store ?? MemoryStore(),
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('new and missing age settings default to ages 3+ with full access', () {
    expect(AgeBandValue.parse(null), AgeBand.allAges);
    expect(AgeBand.allAges.value, '3+');
    expect(AgeBand.allAges.maxBook, 4);
  });

  test('saved child age bands remain compatible', () {
    expect(AgeBandValue.parse('7-9'), AgeBand.sevenToNine);
    expect(AgeBandValue.parse('10-12'), AgeBand.tenToTwelve);
    expect(AgeBandValue.parse('13-15'), AgeBand.thirteenToFifteen);
  });

  test('unknown tutorial versions and phases never force existing users', () {
    expect(
      TutorialProgress.fromJson({
        'version': 999,
        'phase': 'home',
        'levelId': TutorialProgress.defaultLevelId,
      }).isCompleted,
      isTrue,
    );
    expect(
      TutorialProgress.fromJson({
        'version': TutorialProgress.currentVersion,
        'phase': 'futurePhase',
        'levelId': TutorialProgress.defaultLevelId,
      }).isCompleted,
      isTrue,
    );
  });

  test(
    'unknown tutorial data normalizes the legacy seen flag safely',
    () async {
      final store = MemoryStore(
        jsonEncode({
          'storageVersion': 6,
          'contentVersion': 'test-catalog-v1',
          'activeProfileId': 'profile-corrupt-tutorial',
          'profiles': {
            'profile-corrupt-tutorial': {
              'id': 'profile-corrupt-tutorial',
              'nickname': 'Existing learner',
              'ageBand': '3+',
              'uiLanguage': 'zh-CN',
              'clueLanguage': 'en',
              'createdAt': DateTime.utc(2026, 8, 2).toIso8601String(),
              'hasSeenGettingStarted': false,
              'tutorialProgress': {
                'version': 999,
                'phase': 'home',
                'levelId': TutorialProgress.defaultLevelId,
              },
              'coins': 39,
              'levels': {},
              'review': {},
              'activeDates': [],
            },
          },
        }),
      );
      final controller = testController(store);

      await controller.initialize();

      expect(controller.hasActiveTutorial, isFalse);
      expect(controller.needsGettingStarted, isFalse);
      expect(controller.activeProfile!.hasSeenGettingStarted, isTrue);
      expect(controller.activeProfile!.coins, 39);
    },
  );

  test('recovers from malformed local save without a blank screen', () async {
    final controller = testController(MemoryStore('{broken'));
    await controller.initialize();
    expect(controller.storageStatus, StorageStatus.recovered);
    expect(controller.hasProfile, isFalse);
  });

  test('future save is preserved and never overwritten', () async {
    final raw = jsonEncode({'storageVersion': 999, 'profiles': {}});
    final store = MemoryStore(raw);
    final controller = testController(store);
    await controller.initialize();

    expect(controller.storageStatus, StorageStatus.unsupportedVersion);
    expect(store.futureBackup, raw);
    expect(store.value, raw);
  });

  test(
    'v3 migrates to v6 without losing progress, review, coins or age',
    () async {
      final dueAt = DateTime.utc(2026, 8, 1).toIso8601String();
      final raw = jsonEncode({
        'storageVersion': 3,
        'contentVersion': 'legacy',
        'activeProfileId': 'profile-1',
        'profiles': {
          'profile-1': {
            'id': 'profile-1',
            'nickname': 'Legacy',
            'ageBand': '10-12',
            'uiLanguage': 'zh-CN',
            'clueLanguage': 'en',
            'createdAt': DateTime.utc(2025).toIso8601String(),
            'coins': 88,
            'levels': {
              'nce-1997-b1-level-001': {
                'solvedWordIds': ['nce-1997-cat'],
                'completed': true,
                'rewardClaimed': true,
                'bestStars': 3,
                'attemptCount': 2,
                'wrongAttempts': 1,
                'hintCount': 1,
                'firstTryCorrect': 0,
              },
            },
            'review': {
              'nce-1997-cat': {
                'wordId': 'nce-1997-cat',
                'levelId': 'nce-1997-b1-level-001',
                'dueAt': dueAt,
                'wrongCount': 1,
                'hintCount': 1,
              },
            },
            'activeDates': ['2026-07-31'],
          },
        },
      });
      final store = MemoryStore(raw);
      final controller = testController(store);

      await controller.initialize();
      await Future<void>.delayed(Duration.zero);

      final profile = controller.activeProfile!;
      expect(profile.activeCurriculumId, AppController.defaultCurriculumId);
      expect(profile.coins, 88);
      expect(profile.ageBand, AgeBand.tenToTwelve);
      expect(profile.hasSeenGettingStarted, isTrue);
      expect(profile.tutorialProgress.isCompleted, isTrue);
      expect(controller.needsGettingStarted, isFalse);
      expect(profile.levels['nce-1997-b1-level-001']!.bestStars, 3);
      expect(
        profile.review['nce-1997-cat']!.dueAt.toUtc().toIso8601String(),
        dueAt,
      );
      expect(profile.activeDates, {'2026-07-31'});
      expect(jsonDecode(store.value!)['storageVersion'], 6);
      expect(jsonDecode(store.value!)['contentVersion'], 'test-catalog-v1');
    },
  );

  test('v4 migrates to v6 with assessment fields empty', () async {
    final store = MemoryStore(
      jsonEncode({
        'storageVersion': 4,
        'contentVersion': 'legacy-v4',
        'activeProfileId': 'profile-v4',
        'profiles': {
          'profile-v4': {
            'id': 'profile-v4',
            'nickname': 'Legacy learner',
            'ageBand': '3+',
            'uiLanguage': 'zh-CN',
            'clueLanguage': 'en',
            'createdAt': DateTime.utc(2026, 8, 1).toIso8601String(),
            'activeCurriculumId': 'nce-1997',
            'hasSeenGettingStarted': true,
            'coins': 77,
            'levels': {},
            'review': {},
            'activeDates': ['2026-08-01'],
          },
        },
      }),
    );
    final controller = testController(store);

    await controller.initialize();
    await Future<void>.delayed(Duration.zero);

    expect(controller.activeProfile!.coins, 77);
    expect(controller.activeAssessmentSession, isNull);
    expect(controller.assessmentHistory, isEmpty);
    expect(controller.activeProfile!.tutorialProgress.isCompleted, isTrue);
    expect(jsonDecode(store.value!)['storageVersion'], 6);
  });

  test('v5 migrates to v6 with existing users tutorial-complete', () async {
    final dueAt = DateTime.utc(2026, 8, 20).toIso8601String();
    final historicalAssessment = AssessmentSession(
      selectedAnchor: AssessmentAnchor.kaoyan,
      bankVersion: 'legacy-bank-v1',
      phase: AssessmentPhase.complete,
      responses: const <AssessmentResponse>[],
      usedItemIds: const <String>{},
      theta: 0.25,
      standardError: 0.4,
      estimate: 6800,
      estimateLower: 5900,
      estimateUpper: 7700,
      reliability: AssessmentReliability.good,
      estimateHistory: const <int>[6600, 6800],
      startedAt: DateTime.utc(2026, 8, 2),
      durationMs: 240000,
    );
    final store = MemoryStore(
      jsonEncode({
        'storageVersion': 5,
        'contentVersion': 'legacy-v5',
        'activeProfileId': 'profile-v5',
        'profiles': {
          'profile-v5': {
            'id': 'profile-v5',
            'nickname': 'Existing learner',
            'ageBand': '3+',
            'uiLanguage': 'zh-CN',
            'clueLanguage': 'en',
            'createdAt': DateTime.utc(2026, 8, 2).toIso8601String(),
            'activeCurriculumId': 'ielts-nawl-v1',
            'hasSeenGettingStarted': true,
            'favoriteWordIds': ['ielts-nawl-v1-data'],
            'coins': 91,
            'levels': {
              'ielts-nawl-v1-level-001': {
                'solvedWordIds': ['ielts-nawl-v1-data'],
                'completed': true,
                'rewardClaimed': true,
                'bestStars': 2,
                'attemptCount': 3,
                'wrongAttempts': 1,
                'hintCount': 0,
                'firstTryCorrect': 0,
              },
            },
            'review': {
              'ielts-nawl-v1-data': {
                'wordId': 'ielts-nawl-v1-data',
                'levelId': 'ielts-nawl-v1-level-001',
                'dueAt': dueAt,
                'wrongCount': 1,
                'hintCount': 0,
              },
            },
            'activeDates': ['2026-08-02'],
            'assessmentHistory': [historicalAssessment.toJson()],
          },
        },
      }),
    );
    final controller = testController(store);

    await controller.initialize();
    await Future<void>.delayed(Duration.zero);

    expect(controller.activeProfile!.coins, 91);
    expect(controller.activeProfile!.activeCurriculumId, 'ielts-nawl-v1');
    expect(controller.activeProfile!.tutorialProgress.isCompleted, isTrue);
    expect(controller.activeProfile!.favoriteWordIds, {'ielts-nawl-v1-data'});
    expect(controller.progressFor('ielts-nawl-v1-level-001').solvedWordIds, {
      'ielts-nawl-v1-data',
    });
    expect(controller.progressFor('ielts-nawl-v1-level-001').bestStars, 2);
    expect(
      controller.activeProfile!.review['ielts-nawl-v1-data']!.dueAt
          .toUtc()
          .toIso8601String(),
      dueAt,
    );
    expect(controller.assessmentHistory.single.bankVersion, 'legacy-bank-v1');
    expect(controller.assessmentHistory.single.estimate, 6800);
    expect(jsonDecode(store.value!)['storageVersion'], 6);
  });

  test(
    'unfinished tutorial resumes from the persisted interaction phase',
    () async {
      final store = MemoryStore();
      final controller = testController(store);
      await controller.initialize();
      controller.createProfile(
        nickname: 'Resume tutorial',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      controller.beginTutorial();
      controller.setTutorialPhase(TutorialPhase.courseMap);
      controller.setTutorialPhase(TutorialPhase.gameUi);
      await Future<void>.delayed(Duration.zero);

      final restored = testController(store);
      await restored.initialize();

      expect(restored.hasActiveTutorial, isTrue);
      expect(restored.tutorialProgress!.phase, TutorialPhase.gameUi);
      expect(
        restored.tutorialProgress!.levelId,
        TutorialProgress.defaultLevelId,
      );
    },
  );

  test(
    'unknown tutorial level ids recover to the guided first level',
    () async {
      final store = MemoryStore(
        jsonEncode({
          'storageVersion': 6,
          'contentVersion': 'test-catalog-v1',
          'activeProfileId': 'profile-tutorial',
          'profiles': {
            'profile-tutorial': {
              'id': 'profile-tutorial',
              'nickname': 'Recovered tutorial',
              'ageBand': '3+',
              'uiLanguage': 'zh-CN',
              'clueLanguage': 'en',
              'createdAt': DateTime.utc(2026, 8, 2).toIso8601String(),
              'activeCurriculumId': 'nce-1997',
              'hasSeenGettingStarted': false,
              'tutorialProgress': {
                'version': TutorialProgress.currentVersion,
                'phase': 'home',
                'levelId': 'missing-level',
              },
              'coins': 0,
              'levels': {},
              'review': {},
              'activeDates': [],
            },
          },
        }),
      );
      final controller = testController(store);

      await controller.initialize();

      expect(controller.hasActiveTutorial, isTrue);
      expect(
        controller.tutorialProgress!.levelId,
        TutorialProgress.defaultLevelId,
      );
    },
  );

  test(
    'assessment can pause, resume, complete and retain ten results',
    () async {
      final controller = testController();
      await controller.initialize();
      controller.createProfile(
        nickname: 'Assessment learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );

      await controller.startAssessment(AssessmentAnchor.unrestricted);
      expect(controller.activeAssessmentSession, isNotNull);
      final firstQuestion = controller.currentAssessmentQuestion;
      expect(firstQuestion, isNotNull);

      controller.pauseAssessment();
      expect(controller.activeAssessmentSession, isNotNull);
      controller.resumeAssessment();
      expect(
        controller.currentAssessmentQuestion!.questionId,
        firstQuestion!.questionId,
      );

      while (controller.activeAssessmentSession != null) {
        final question = controller.currentAssessmentQuestion!;
        final answer = question.type == AssessmentQuestionType.multipleChoice
            ? AssessmentAnswer.multipleChoice(
                selectedOptionIndex: question.item.correctOptionIndex,
                responseTimeMs: 1200,
              )
            : AssessmentAnswer.yesNo(
                recognized: question.item.kind == AssessmentItemKind.realWord,
                responseTimeMs: 1200,
              );
        controller.submitAssessmentAnswer(answer);
      }

      expect(controller.assessmentHistory, hasLength(1));
      expect(controller.latestAssessmentResult!.isComplete, isTrue);
      for (var index = 0; index < 11; index += 1) {
        await controller.startAssessment(AssessmentAnchor.primarySchool);
        while (controller.activeAssessmentSession != null) {
          final question = controller.currentAssessmentQuestion!;
          controller.submitAssessmentAnswer(
            question.type == AssessmentQuestionType.multipleChoice
                ? AssessmentAnswer.multipleChoice(
                    selectedOptionIndex: question.item.correctOptionIndex,
                    responseTimeMs: 1500,
                  )
                : AssessmentAnswer.yesNo(
                    recognized:
                        question.item.kind == AssessmentItemKind.realWord,
                    responseTimeMs: 1500,
                  ),
          );
        }
      }
      expect(controller.assessmentHistory, hasLength(10));

      await controller.resetActiveProfile();
      expect(controller.activeAssessmentSession, isNull);
      expect(controller.assessmentHistory, isEmpty);
    },
  );

  test(
    'unfinished assessment resumes the exact question after restart',
    () async {
      final store = MemoryStore();
      final controller = testController(store);
      await controller.initialize();
      controller.createProfile(
        nickname: 'Resume learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      await controller.startAssessment(AssessmentAnchor.unrestricted);
      final questionId = controller.currentAssessmentQuestion!.questionId;
      await Future<void>.delayed(Duration.zero);

      final restored = testController(store);
      await restored.initialize();

      expect(restored.activeAssessmentSession, isNotNull);
      expect(restored.currentAssessmentQuestion!.questionId, questionId);
    },
  );

  test(
    'bank mismatch is persisted immediately and stays discarded after two restarts',
    () async {
      final incompatibleSession = AssessmentSession(
        selectedAnchor: AssessmentAnchor.unrestricted,
        bankVersion: 'assessment-proxy-v1-obsolete',
        phase: AssessmentPhase.adaptive,
        responses: const <AssessmentResponse>[],
        usedItemIds: const <String>{},
        theta: 0,
        standardError: 1,
        estimate: 10000,
        estimateLower: 1000,
        estimateUpper: 19000,
        reliability: AssessmentReliability.good,
        estimateHistory: const <int>[10000],
        startedAt: DateTime.utc(2026, 8, 20),
        durationMs: 1000,
      );
      final historicalSession = AssessmentSession(
        selectedAnchor: AssessmentAnchor.ielts,
        bankVersion: 'assessment-proxy-v1-history',
        phase: AssessmentPhase.complete,
        responses: const <AssessmentResponse>[],
        usedItemIds: const <String>{},
        theta: -0.2,
        standardError: 0.4,
        estimate: 9000,
        estimateLower: 7800,
        estimateUpper: 10200,
        reliability: AssessmentReliability.good,
        estimateHistory: const <int>[9000],
        startedAt: DateTime.utc(2026, 8, 19),
        durationMs: 420000,
      );
      final store = MemoryStore(
        jsonEncode({
          'storageVersion': 6,
          'contentVersion': 'test-catalog-v1',
          'activeProfileId': 'profile-mismatch',
          'profiles': {
            'profile-mismatch': {
              'id': 'profile-mismatch',
              'nickname': 'Bank mismatch',
              'ageBand': '3+',
              'uiLanguage': 'zh-CN',
              'clueLanguage': 'en',
              'createdAt': DateTime.utc(2026, 8, 18).toIso8601String(),
              'activeCurriculumId': 'nce-1997',
              'hasSeenGettingStarted': true,
              'coins': 23,
              'levels': {},
              'review': {},
              'activeDates': const <String>[],
              'activeAssessmentSession': incompatibleSession.toJson(),
              'assessmentHistory': [historicalSession.toJson()],
            },
          },
        }),
      );

      final firstRestart = testController(store);
      await firstRestart.initialize();
      expect(firstRestart.activeAssessmentSession, isNull);
      expect(
        firstRestart.assessmentHistory.single.bankVersion,
        'assessment-proxy-v1-history',
      );
      final persistedAfterDiscard =
          jsonDecode(store.value!) as Map<String, dynamic>;
      final persistedProfile =
          (persistedAfterDiscard['profiles']
                  as Map<String, dynamic>)['profile-mismatch']
              as Map<String, dynamic>;
      expect(persistedProfile['activeAssessmentSession'], isNull);

      final secondRestart = testController(store);
      await secondRestart.initialize();
      expect(secondRestart.activeAssessmentSession, isNull);
      expect(
        secondRestart.assessmentHistory.single.bankVersion,
        'assessment-proxy-v1-history',
      );
      expect(secondRestart.activeProfile!.coins, 23);
    },
  );

  test('new profiles persist the required contextual tutorial', () async {
    final store = MemoryStore();
    final controller = testController(store);
    await controller.initialize();

    controller.createProfile(
      nickname: 'New learner',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );

    expect(controller.needsGettingStarted, isTrue);
    expect(controller.activeProfile!.hasSeenGettingStarted, isFalse);

    controller.beginTutorial();
    await Future<void>.delayed(Duration.zero);

    expect(controller.needsGettingStarted, isFalse);
    expect(controller.hasActiveTutorial, isTrue);
    expect(
      controller.activeProfile!.tutorialProgress.phase,
      TutorialPhase.home,
    );
    controller.setTutorialPhase(TutorialPhase.courseMap);
    controller.setTutorialPhase(TutorialPhase.gameUi);
    controller.setTutorialPhase(TutorialPhase.firstWordDetail);
    controller.setTutorialPhase(TutorialPhase.levelComplete);
    controller.setTutorialPhase(TutorialPhase.completed);
    await Future<void>.delayed(Duration.zero);

    expect(controller.hasActiveTutorial, isFalse);
    expect(controller.activeProfile!.hasSeenGettingStarted, isTrue);
    final saved = jsonDecode(store.value!) as Map<String, dynamic>;
    final profile = (saved['profiles'] as Map<String, dynamic>).values.single;
    expect(profile['hasSeenGettingStarted'], isTrue);
    expect(profile['tutorialProgress']['phase'], 'completed');
  });

  test(
    'course selection is independent and remembered in the profile',
    () async {
      final store = MemoryStore();
      final controller = testController(store);
      await controller.initialize();
      controller.createProfile(
        nickname: 'Learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );

      expect(controller.activeCurriculum.id, 'nce-1997');
      controller.selectCurriculum('ielts-nawl-v1');
      await Future<void>.delayed(Duration.zero);

      expect(controller.activeCurriculum.id, 'ielts-nawl-v1');
      final saved = jsonDecode(store.value!) as Map<String, dynamic>;
      final profile = (saved['profiles'] as Map<String, dynamic>).values.single;
      expect(profile['activeCurriculumId'], 'ielts-nawl-v1');
    },
  );

  test(
    'navigation crosses NCE book 100 and stops at IELTS final level',
    () async {
      final controller = testController();
      await controller.initialize();
      controller.createProfile(
        nickname: 'Navigator',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.english,
      );
      final nce100 = await controller.repository.loadLevel(
        'nce-1997-b1-level-100',
      );
      expect(controller.nextLevelId(nce100.level), 'nce-1997-b2-level-001');

      controller.selectCurriculum('ielts-nawl-v1');
      final ieltsFinal = await controller.repository.loadLevel(
        'ielts-nawl-v1-level-200',
      );
      expect(controller.nextLevelId(ieltsFinal.level), isNull);
    },
  );

  test(
    'age bands gate rated levels, continuation and next navigation',
    () async {
      final controller = AppController(
        repository: testCourseRepository(
          ratings: const {
            'nce-1997-b1-level-001': '13-plus',
            'nce-1997-b1-level-100': 'parent-review',
          },
        ),
        store: MemoryStore(),
      );
      await controller.initialize();
      controller.createProfile(
        nickname: 'Rated learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.english,
      );

      expect(controller.canAccessLevel('nce-1997-b1-level-001'), isFalse);
      expect(controller.canAccessLevel('nce-1997-b1-level-100'), isFalse);
      expect(controller.continueLevelId, 'nce-1997-b2-level-001');

      controller.updatePreferences(ageBand: AgeBand.thirteenToFifteen);
      expect(controller.canAccessLevel('nce-1997-b1-level-001'), isTrue);
      expect(controller.canAccessLevel('nce-1997-b1-level-100'), isFalse);
      expect(controller.continueLevelId, 'nce-1997-b1-level-001');
      final first = await controller.repository.loadLevel(
        'nce-1997-b1-level-001',
      );
      expect(controller.nextLevelId(first.level), 'nce-1997-b2-level-001');

      controller.updatePreferences(ageBand: AgeBand.tenToTwelve);
      expect(controller.canAccessLevel('nce-1997-b1-level-001'), isFalse);
    },
  );

  test('review debt keeps NCE and IELTS words isolated', () async {
    final controller = testController();
    await controller.initialize();
    controller.createProfile(
      nickname: 'Reviewer',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.english,
    );
    controller.recordWrong(
      levelId: 'nce-1997-b1-level-001',
      wordId: 'nce-1997-cat',
    );
    controller.recordWrong(
      levelId: 'ielts-nawl-v1-level-001',
      wordId: 'ielts-nawl-v1-data',
    );

    expect(controller.activeProfile!.review.keys, {
      'nce-1997-cat',
      'ielts-nawl-v1-data',
    });
    controller.completeReview('nce-1997-cat');
    expect(controller.activeProfile!.review.keys, {'ielts-nawl-v1-data'});
  });

  test('profiles keep progress isolated', () async {
    final controller = testController();
    await controller.initialize();
    controller.createProfile(
      nickname: 'One',
      ageBand: AgeBand.tenToTwelve,
      uiLanguage: UiLanguage.english,
    );
    final firstId = controller.activeProfile!.id;
    controller.recordWrong(
      levelId: 'nce-1997-b1-level-001',
      wordId: 'nce-1997-cat',
    );
    controller.createProfile(
      nickname: 'Two',
      ageBand: AgeBand.sevenToNine,
      uiLanguage: UiLanguage.chinese,
    );
    expect(controller.activeProfile!.review, isEmpty);
    controller.switchProfile(firstId);
    expect(controller.activeProfile!.review, contains('nce-1997-cat'));
  });
}
