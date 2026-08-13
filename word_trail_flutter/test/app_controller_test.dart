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
    'v3 migrates to v5 without losing progress, review, coins or age',
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
      expect(controller.needsGettingStarted, isFalse);
      expect(profile.levels['nce-1997-b1-level-001']!.bestStars, 3);
      expect(
        profile.review['nce-1997-cat']!.dueAt.toUtc().toIso8601String(),
        dueAt,
      );
      expect(profile.activeDates, {'2026-07-31'});
      expect(jsonDecode(store.value!)['storageVersion'], 5);
      expect(jsonDecode(store.value!)['contentVersion'], 'test-catalog-v1');
    },
  );

  test('v4 migrates to v5 with assessment fields empty', () async {
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
    expect(jsonDecode(store.value!)['storageVersion'], 5);
  });

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

  test('new profiles see the guide once and completion is persisted', () async {
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

    controller.completeGettingStarted();
    await Future<void>.delayed(Duration.zero);

    expect(controller.needsGettingStarted, isFalse);
    expect(controller.activeProfile!.hasSeenGettingStarted, isTrue);
    final saved = jsonDecode(store.value!) as Map<String, dynamic>;
    final profile = (saved['profiles'] as Map<String, dynamic>).values.single;
    expect(profile['hasSeenGettingStarted'], isTrue);
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
