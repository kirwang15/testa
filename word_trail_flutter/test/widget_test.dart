import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:word_trail_app/app_controller.dart';
import 'package:word_trail_app/main.dart';
import 'package:word_trail_app/models/assessment.dart';
import 'package:word_trail_app/models/player_state.dart';
import 'package:word_trail_app/screens/assessment_result_screen.dart';
import 'package:word_trail_app/screens/assessment_intro_screen.dart';
import 'package:word_trail_app/screens/assessment_screen.dart';
import 'package:word_trail_app/screens/game_screen.dart';
import 'package:word_trail_app/screens/getting_started_screen.dart';
import 'package:word_trail_app/screens/home_screen.dart';
import 'package:word_trail_app/screens/map_screen.dart';
import 'package:word_trail_app/screens/review_screen.dart';
import 'package:word_trail_app/screens/wordbook_screen.dart';
import 'package:word_trail_app/services/local_store.dart';

import 'support/test_course_data.dart';

AppController widgetController({
  Map<String, String> ratings = const <String, String>{},
  LocalStore? store,
}) => AppController(
  repository: testCourseRepository(ratings: ratings),
  store: store,
);

class _MemoryLocalStore extends LocalStore {
  String? value;

  @override
  Future<String?> read() async => value;

  @override
  Future<bool> write(String nextValue) async {
    value = nextValue;
    return true;
  }

  @override
  Future<void> clear() async => value = null;
}

void configurePhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void configureSmallLandscape(WidgetTester tester) {
  tester.view.physicalSize = const Size(568, 320);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Widget accessibilityHarness(Widget child) => MaterialApp(
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(
      textScaler: const TextScaler.linear(1.8),
      disableAnimations: true,
    ),
    child: child!,
  ),
  home: child,
);

AssessmentSession assessmentResult({
  AssessmentReliability reliability = AssessmentReliability.good,
}) => AssessmentSession(
  selectedAnchor: AssessmentAnchor.ielts,
  bankVersion: 'assessment-proxy-v1-widget-test',
  phase: AssessmentPhase.complete,
  responses: const <AssessmentResponse>[],
  usedItemIds: const <String>{},
  theta: 0,
  standardError: 0.4,
  estimate: 7200,
  estimateLower: 6100,
  estimateUpper: 8400,
  reliability: reliability,
  estimateHistory: const <int>[7200],
  startedAt: DateTime(2026, 8, 12),
  durationMs: 180000,
);

Future<void> initializeController(
  WidgetTester tester,
  AppController controller,
) async {
  await tester.runAsync(controller.initialize);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('onboarding fits a phone without layout exceptions', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    configurePhone(tester);

    await tester.pumpWidget(WordTrailApp(controller: controller));
    await tester.pumpAndSettle();

    expect(find.text('选择你的学习路线'), findsOneWidget);
    expect(find.text('3岁以上 · 全年龄段'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'small landscape, large text and disabled animations keep critical CTAs reachable',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final controller = widgetController();
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Accessible learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      configureSmallLandscape(tester);

      await tester.pumpWidget(
        accessibilityHarness(GettingStartedScreen(controller: controller)),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('tutorial-begin')));
      expect(find.byKey(const Key('tutorial-begin')), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(
        accessibilityHarness(AssessmentIntroScreen(controller: controller)),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('开始估算'));
      expect(find.text('开始估算'), findsOneWidget);
      expect(find.textContaining('6–10 分钟'), findsOneWidget);
      expect(find.textContaining('52–80 题'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'small accessible landscape completes the full three-word tutorial',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final controller = AppController(store: _MemoryLocalStore());
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Small tutorial learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      controller.beginTutorial();
      controller.setTutorialPhase(TutorialPhase.courseMap);
      controller.setTutorialPhase(TutorialPhase.gameUi);
      final bundle = await tester.runAsync(
        () => controller.repository.loadLevel(TutorialProgress.defaultLevelId),
      );
      expect(bundle!.level.words.map((word) => word.word), [
        'WHAT',
        'HERE',
        'SORRY',
      ]);
      configureSmallLandscape(tester);

      await tester.pumpWidget(
        accessibilityHarness(
          GameScreen(
            controller: controller,
            levelId: TutorialProgress.defaultLevelId,
            returnContext: const GameReturnContext(
              source: GameEntrySource.tutorial,
              curriculumId: 'nce-1997',
              trackId: 'nce-1997-b1',
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));

      Future<void> enterLetters(List<String> letters) async {
        for (final letter in letters) {
          final button = find.bySemanticsLabel('字母按钮 $letter').first;
          await tester.ensureVisible(button);
          await tester.tap(button);
          await tester.pump();
        }
        await tester.pump(const Duration(milliseconds: 350));
        expect(tester.takeException(), isNull);
      }

      await enterLetters(const ['W', 'H', 'A', 'T']);
      expect(controller.tutorialProgress!.phase, TutorialPhase.firstWordDetail);
      await tester.ensureVisible(find.text('1 · 横向 · 4'));
      await tester.tap(find.text('1 · 横向 · 4'));
      await tester.pump();
      expect(controller.tutorialProgress!.phase, TutorialPhase.levelComplete);
      await tester.ensureVisible(find.byKey(const Key('game-continue-answer')));
      await tester.tap(find.byKey(const Key('game-continue-answer')));
      await tester.pump();

      await enterLetters(const ['E', 'R', 'E']);
      await enterLetters(const ['S', 'O', 'R', 'Y']);
      expect(
        controller.progressFor(TutorialProgress.defaultLevelId).solvedWordIds,
        hasLength(3),
      );
      await tester.ensureVisible(find.byKey(const Key('tutorial-complete')));
      await tester.tap(find.byKey(const Key('tutorial-complete')));
      await tester.pumpAndSettle();

      expect(controller.hasActiveTutorial, isFalse);
      expect(controller.activeProfile!.hasSeenGettingStarted, isTrue);
      expect(tester.takeException(), isNull);
    },
    timeout: const Timeout(Duration(minutes: 1)),
  );

  testWidgets(
    'small accessible landscape keeps assessment answering reachable',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final controller = widgetController();
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Small assessment learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      await tester.runAsync(
        () => controller.startAssessment(AssessmentAnchor.unrestricted),
      );
      configureSmallLandscape(tester);

      await tester.pumpWidget(
        accessibilityHarness(AssessmentScreen(controller: controller)),
      );
      await tester.pump();
      final answer = find.text('认识');
      await tester.ensureVisible(answer);
      expect(answer, findsOneWidget);
      await tester.tap(answer);
      await tester.pump(const Duration(milliseconds: 150));

      expect(controller.activeAssessmentSession!.responses, hasLength(1));
      _expectNoAssessmentAnswerLeak();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'small accessible landscape keeps the wordbook favorite CTA reachable',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final controller = widgetController();
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Small word collector',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      await tester.runAsync(
        () => controller.repository.loadLevel('nce-1997-b1-level-001'),
      );
      controller.recordCorrect(
        levelId: 'nce-1997-b1-level-001',
        wordId: 'nce-1997-cat',
        firstTry: true,
      );
      controller.toggleFavorite('nce-1997-cat');
      configureSmallLandscape(tester);

      await tester.pumpWidget(
        accessibilityHarness(WordbookScreen(controller: controller)),
      );
      await tester.pumpAndSettle();
      final favorite = find.byTooltip('取消收藏');
      await tester.ensureVisible(favorite);
      expect(favorite, findsOneWidget);
      await tester.tap(favorite);
      await tester.pump();

      expect(controller.isFavorite('nce-1997-cat'), isFalse);
      expect(find.byTooltip('收藏'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('home selects either course without NCE completion', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    configurePhone(tester);

    await tester.pumpWidget(WordTrailApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '测试用户');
    await tester.tap(find.text('开始冒险'));
    await tester.pumpAndSettle();

    expect(find.text('完成一关，真正学会操作'), findsOneWidget);
    await tester.tap(find.text('稍后从首页继续'));
    await tester.pumpAndSettle();

    expect(controller.activeProfile!.ageBand, AgeBand.allAges);
    expect(controller.canAccessBook(4), isTrue);
    expect(find.text('新概念英语'), findsOneWidget);
    expect(find.text('IELTS 备考词汇'), findsOneWidget);
    await tester.tap(find.text('IELTS 备考词汇'));
    await tester.pumpAndSettle();

    expect(controller.activeCurriculum.id, 'ielts-nawl-v1');
    expect(find.text('第 1 阶段 · 第 1 关'), findsOneWidget);
    expect(find.text('共 4 关'), findsOneWidget);
    expect(find.text('3岁以上 · 全年龄段'), findsOneWidget);
    expect(find.text('学习摘要'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('home exposes language and a local solved/favorite wordbook', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Word collector',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    await tester.runAsync(
      () => controller.repository.loadLevel('nce-1997-b1-level-001'),
    );
    controller.recordCorrect(
      levelId: 'nce-1997-b1-level-001',
      wordId: 'nce-1997-cat',
      firstTry: true,
    );
    controller.toggleFavorite('nce-1997-cat');
    configurePhone(tester);

    await tester.pumpWidget(
      MaterialApp(home: HomeScreen(controller: controller)),
    );
    await tester.pumpAndSettle();
    expect(find.text('词汇册'), findsOneWidget);
    expect(find.text('语言'), findsOneWidget);
    expect(find.text('1 个已学或收藏单词'), findsOneWidget);

    await tester.ensureVisible(find.text('词汇册'));
    await tester.tap(find.text('词汇册'));
    await tester.pumpAndSettle();
    expect(find.byType(WordbookScreen), findsOneWidget);
    expect(find.text('cat'), findsOneWidget);
    expect(find.textContaining('/test/ · noun · B1'), findsOneWidget);
    expect(find.textContaining('英文释义'), findsOneWidget);
    expect(find.textContaining('中文释义'), findsOneWidget);
    expect(find.textContaining('A test example.'), findsOneWidget);
    expect(find.textContaining('新概念英语第 1 册 · 第 1 课'), findsOneWidget);
    expect(find.text('已完成'), findsOneWidget);
    expect(find.text('已收藏'), findsOneWidget);

    await tester.tap(find.byTooltip('取消收藏'));
    await tester.pump();
    expect(controller.isFavorite('nce-1997-cat'), isFalse);
    expect(find.text('已收藏'), findsNothing);

    Navigator.of(tester.element(find.byType(WordbookScreen))).pop();
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('语言'));
    await tester.tap(find.text('语言'));
    await tester.pumpAndSettle();
    expect(find.text('界面语言'), findsOneWidget);
    expect(find.text('默认提示语言'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('wordbook has a useful empty state', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'New collector',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    configurePhone(tester);

    await tester.pumpWidget(
      MaterialApp(home: WordbookScreen(controller: controller)),
    );
    await tester.pumpAndSettle();

    expect(find.text('词汇册还是空的。完成一个单词或将它收藏后，就会显示在这里。'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('new user guide covers the first action chain and can reopen', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    configurePhone(tester);

    await tester.pumpWidget(WordTrailApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '新手');
    await tester.tap(find.text('开始冒险'));
    await tester.pumpAndSettle();

    expect(find.text('完成一关，真正学会操作'), findsOneWidget);
    await tester.tap(find.text('开始新手第一关'));
    await tester.pumpAndSettle();

    expect(controller.needsGettingStarted, isFalse);
    expect(controller.hasActiveTutorial, isTrue);
    expect(find.text('新手第一关'), findsOneWidget);
    expect(find.textContaining('词汇量测试'), findsWidgets);

    await tester.tap(find.text('继续新手第一关'));
    await tester.pumpAndSettle();
    expect(find.text('地图怎么用'), findsOneWidget);
    expect(controller.tutorialProgress!.phase, TutorialPhase.courseMap);
    await tester.runAsync(
      () => controller.repository.loadLevel('nce-1997-b1-level-001'),
    );

    await tester.tap(find.bySemanticsLabel('第 1 关'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.text('首关操作提示'), findsOneWidget);
    expect(controller.tutorialProgress!.phase, TutorialPhase.gameUi);

    for (final letter in ['C', 'A', 'T']) {
      final button = find.bySemanticsLabel('字母按钮 $letter').first;
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pump();
    }
    await tester.pump(const Duration(milliseconds: 350));
    expect(controller.tutorialProgress!.phase, TutorialPhase.firstWordDetail);
    expect(find.textContaining('请点击绿色提示条'), findsOneWidget);

    await tester.ensureVisible(find.text('1 · 横向 · 3'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('1 · 横向 · 3'));
    await tester.pump(const Duration(milliseconds: 250));
    expect(controller.tutorialProgress!.phase, TutorialPhase.levelComplete);
    expect(find.text('cat'), findsOneWidget);
    expect(find.text('继续填写'), findsOneWidget);
    await tester.tap(find.text('完成新手指引'));
    await tester.pumpAndSettle();

    expect(controller.hasActiveTutorial, isFalse);
    expect(controller.activeProfile!.hasSeenGettingStarted, isTrue);

    await tester.ensureVisible(find.text('设置'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('设置'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('新手指引'));
    await tester.pumpAndSettle();
    expect(find.text('新手指引'), findsOneWidget);
    await tester.tap(find.text('新手指引'));
    await tester.pumpAndSettle();
    expect(find.text('首页'), findsOneWidget);
    expect(find.text('关卡操作'), findsOneWidget);
    expect(controller.hasActiveTutorial, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'active tutorial uses ordinary continue and replays an already completed level',
    (tester) async {
      final store = _MemoryLocalStore();
      final controller = widgetController(store: store);
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: '普通入口新手',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      final bundle = await tester.runAsync(
        () => controller.repository.loadLevel('nce-1997-b1-level-001'),
      );
      controller.completeLevel(bundle!.level);
      controller.beginTutorial();
      configurePhone(tester);

      await tester.pumpWidget(
        MaterialApp(home: HomeScreen(controller: controller)),
      );
      await tester.pump(const Duration(milliseconds: 250));
      expect(controller.tutorialProgress!.phase, TutorialPhase.home);

      await tester.ensureVisible(find.text('继续今日冒险'));
      await tester.tap(find.text('继续今日冒险'));
      await tester.pumpAndSettle();
      expect(find.text('地图怎么用'), findsOneWidget);
      expect(controller.tutorialProgress!.phase, TutorialPhase.courseMap);

      await tester.tap(find.bySemanticsLabel('第 1 关，3 星'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));
      expect(controller.tutorialProgress!.phase, TutorialPhase.gameUi);
      expect(
        tester.widget<GameScreen>(find.byType(GameScreen)).replay,
        isFalse,
      );

      for (final letter in ['C', 'A', 'T']) {
        final button = find.bySemanticsLabel('字母按钮 $letter').first;
        await tester.ensureVisible(button);
        await tester.tap(button);
        await tester.pump();
      }
      await tester.pump(const Duration(milliseconds: 350));
      expect(controller.tutorialProgress!.phase, TutorialPhase.firstWordDetail);

      await tester.ensureVisible(find.text('1 · 横向 · 3'));
      await tester.tap(find.text('1 · 横向 · 3'));
      await tester.pump(const Duration(milliseconds: 250));
      expect(controller.tutorialProgress!.phase, TutorialPhase.levelComplete);
      await tester.tap(find.text('完成新手指引'));
      await tester.pumpAndSettle();

      expect(controller.hasActiveTutorial, isFalse);
      expect(controller.activeProfile!.hasSeenGettingStarted, isTrue);
    },
  );

  testWidgets(
    'production guided level requires all three real words before tutorial completion',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final controller = AppController(store: _MemoryLocalStore());
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Production guide',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      controller.beginTutorial();
      controller.setTutorialPhase(TutorialPhase.courseMap);
      controller.setTutorialPhase(TutorialPhase.gameUi);
      final bundle = await tester.runAsync(
        () => controller.repository.loadLevel(TutorialProgress.defaultLevelId),
      );
      expect(bundle!.level.words.map((word) => word.word), [
        'WHAT',
        'HERE',
        'SORRY',
      ]);
      configurePhone(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            controller: controller,
            levelId: TutorialProgress.defaultLevelId,
            returnContext: const GameReturnContext(
              source: GameEntrySource.tutorial,
              curriculumId: 'nce-1997',
              trackId: 'nce-1997-b1',
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 350));

      Future<void> enterLetters(List<String> letters) async {
        for (final letter in letters) {
          final button = find.bySemanticsLabel('字母按钮 $letter').first;
          await tester.ensureVisible(button);
          await tester.tap(button);
          await tester.pump();
        }
        await tester.pump(const Duration(milliseconds: 350));
      }

      await enterLetters(const ['W', 'H', 'A', 'T']);
      expect(
        controller.progressFor(TutorialProgress.defaultLevelId).solvedWordIds,
        {'nce-1997-b1-what'},
      );
      expect(controller.tutorialProgress!.phase, TutorialPhase.firstWordDetail);
      expect(find.byKey(const Key('tutorial-complete')), findsNothing);

      await tester.ensureVisible(find.text('1 · 横向 · 4'));
      await tester.tap(find.text('1 · 横向 · 4'));
      await tester.pump();
      expect(controller.tutorialProgress!.phase, TutorialPhase.levelComplete);
      await tester.tap(find.byKey(const Key('game-continue-answer')));
      await tester.pump();

      await enterLetters(const ['E', 'R', 'E']);
      expect(
        controller.progressFor(TutorialProgress.defaultLevelId).solvedWordIds,
        {'nce-1997-b1-what', 'nce-1997-b1-here'},
      );
      expect(find.byKey(const Key('tutorial-complete')), findsNothing);

      await enterLetters(const ['S', 'O', 'R', 'Y']);
      final progress = controller.progressFor(TutorialProgress.defaultLevelId);
      expect(progress.completed, isTrue);
      expect(progress.solvedWordIds, hasLength(3));
      expect(controller.hasActiveTutorial, isTrue);
      await tester.ensureVisible(find.byKey(const Key('tutorial-complete')));
      await tester.tap(find.byKey(const Key('tutorial-complete')));
      await tester.pumpAndSettle();
      expect(controller.hasActiveTutorial, isFalse);
      expect(controller.activeProfile!.hasSeenGettingStarted, isTrue);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Chinese game semantics and completion copy are user-facing', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Tester',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    await tester.runAsync(
      () => controller.repository.loadLevel('nce-1997-b1-level-001'),
    );
    configurePhone(tester);
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            controller: controller,
            levelId: 'nce-1997-b1-level-001',
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.text('1. 先阅读当前提示，再点击下方字母按钮。'), findsOneWidget);
      expect(find.bySemanticsLabel('填字棋盘'), findsOneWidget);
      expect(find.bySemanticsLabel('字母按钮 C'), findsWidgets);
      expect(find.bySemanticsLabel('Crossword board'), findsNothing);
      for (final letter in ['C', 'A', 'T']) {
        final button = find.bySemanticsLabel('字母按钮 $letter').first;
        await tester.ensureVisible(button);
        await tester.pump(const Duration(milliseconds: 250));
        await tester.tap(button);
        await tester.pump();
      }
      await tester.pumpAndSettle();

      expect(find.text('全部单词都完成了，做得好！'), findsOneWidget);
      expect(find.text('检查单词'), findsNothing);
      expect(find.textContaining('Beta'), findsNothing);
      expect(find.textContaining('遮住棋盘'), findsNothing);
      expect(find.bySemanticsLabel('获得 3 星中的 3 星'), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('filled words auto-check once and retain red editable mistakes', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Auto checker',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    await tester.runAsync(
      () => controller.repository.loadLevel('nce-1997-b1-level-001'),
    );
    configurePhone(tester);
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            controller: controller,
            levelId: 'nce-1997-b1-level-001',
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      for (var index = 0; index < 3; index++) {
        final button = find.bySemanticsLabel('字母按钮 C').first;
        await tester.ensureVisible(button);
        await tester.tap(button);
        await tester.pump();
      }
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.text('还差一点'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('需要修改')), findsNWidgets(3));
      expect(controller.progressFor('nce-1997-b1-level-001').wrongAttempts, 1);
      await tester.pump(const Duration(seconds: 1));
      expect(controller.progressFor('nce-1997-b1-level-001').wrongAttempts, 1);

      await tester.ensureVisible(find.text('清空'));
      await tester.tap(find.text('清空'));
      await tester.pump();
      for (final letter in ['C', 'A', 'T']) {
        final button = find.bySemanticsLabel('字母按钮 $letter').first;
        await tester.ensureVisible(button);
        await tester.tap(button);
        await tester.pump();
      }
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('全部单词都完成了，做得好！'), findsOneWidget);
      expect(find.text('检查单词'), findsNothing);
      expect(controller.progressFor('nce-1997-b1-level-001').wrongAttempts, 1);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets(
    'pronunciation replays without consuming the separate letter hint',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      var speechCalls = 0;
      const speechChannel = MethodChannel('word_trail/speech');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(speechChannel, (call) async {
            if (call.method == 'speak') speechCalls += 1;
            return true;
          });
      addTearDown(
        () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(speechChannel, null),
      );

      final controller = widgetController();
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Audio learner',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      await tester.runAsync(
        () => controller.repository.loadLevel('nce-1997-b1-level-001'),
      );
      configurePhone(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            controller: controller,
            levelId: 'nce-1997-b1-level-001',
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      final listen = find.text('听发音');
      await tester.ensureVisible(listen);
      await tester.tap(listen);
      await tester.pumpAndSettle();
      await tester.tap(listen);
      await tester.pumpAndSettle();
      expect(speechCalls, 2);
      expect(controller.progressFor('nce-1997-b1-level-001').hintCount, 0);

      final letterHint = find.text('字母提示');
      await tester.ensureVisible(letterHint);
      await tester.tap(letterHint);
      await tester.pumpAndSettle();
      expect(find.text('首字母已放入棋盘。'), findsOneWidget);
      expect(controller.progressFor('nce-1997-b1-level-001').hintCount, 1);
    },
  );

  testWidgets(
    'solved-word details are read-only and remain switchable after completion',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final controller = widgetController();
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Detail viewer',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      await tester.runAsync(
        () => controller.repository.loadLevel('nce-1997-b3-level-001'),
      );
      configurePhone(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: GameScreen(
            controller: controller,
            levelId: 'nce-1997-b3-level-001',
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      for (final letter in ['S', 'U', 'N']) {
        final button = find.bySemanticsLabel('字母按钮 $letter').first;
        await tester.ensureVisible(button);
        await tester.tap(button);
        await tester.pump();
      }
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('1 · 横向 · 3'), findsOneWidget);
      await tester.ensureVisible(find.text('1 · 横向 · 3'));
      await tester.tap(find.text('1 · 横向 · 3'));
      await tester.pump();

      expect(find.text('sun'), findsOneWidget);
      expect(find.textContaining('英文释义'), findsOneWidget);
      expect(find.textContaining('中文释义'), findsOneWidget);
      expect(find.textContaining('/sun/'), findsOneWidget);
      final before = controller.progressFor('nce-1997-b3-level-001');
      final letterInkWell = tester.widget<InkWell>(
        find
            .descendant(
              of: find.bySemanticsLabel('字母按钮 U').first,
              matching: find.byType(InkWell),
            )
            .first,
      );
      expect(letterInkWell.onTap, isNull);
      final hintButton = tester.widget<OutlinedButton>(
        find
            .ancestor(
              of: find.text('字母提示'),
              matching: find.byType(OutlinedButton),
            )
            .first,
      );
      expect(hintButton.onPressed, isNull);
      expect(
        controller.progressFor('nce-1997-b3-level-001').hintCount,
        before.hintCount,
      );
      expect(
        controller.progressFor('nce-1997-b3-level-001').wrongAttempts,
        before.wrongAttempts,
      );

      await tester.tap(find.text('继续填写'));
      await tester.pump();
      for (final letter in ['U', 'T']) {
        final button = find.bySemanticsLabel('字母按钮 $letter').first;
        await tester.ensureVisible(button);
        await tester.tap(button);
        await tester.pump();
      }
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('全部单词都完成了，做得好！'), findsOneWidget);

      await tester.ensureVisible(find.text('1 · 横向 · 3'));
      await tester.tap(find.text('1 · 横向 · 3'));
      await tester.pump();
      expect(find.text('sun'), findsOneWidget);
      await tester.ensureVisible(find.text('2 · 纵向 · 3'));
      await tester.tap(find.text('2 · 纵向 · 3'));
      await tester.pump();
      expect(find.text('nut'), findsOneWidget);
      expect(controller.progressFor('nce-1997-b3-level-001').completed, isTrue);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('next level keeps the original home return destination', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Navigator',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    controller.beginTutorial();
    controller.setTutorialPhase(TutorialPhase.courseMap);
    controller.setTutorialPhase(TutorialPhase.gameUi);
    controller.setTutorialPhase(TutorialPhase.firstWordDetail);
    controller.setTutorialPhase(TutorialPhase.levelComplete);
    controller.setTutorialPhase(TutorialPhase.completed);
    await tester.runAsync(() async {
      await controller.repository.loadLevel('nce-1997-b1-level-001');
      await controller.repository.loadLevel('nce-1997-b1-level-100');
    });
    configurePhone(tester);

    await tester.pumpWidget(
      MaterialApp(home: HomeScreen(controller: controller)),
    );
    await tester.pump(const Duration(milliseconds: 250));
    await tester.ensureVisible(find.text('继续今日冒险'));
    await tester.tap(find.text('继续今日冒险'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    for (final letter in ['C', 'A', 'T']) {
      final button = find.bySemanticsLabel('字母按钮 $letter').first;
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pump();
    }
    await tester.pump(const Duration(milliseconds: 300));
    await tester.ensureVisible(find.text('下一关'));
    await tester.tap(find.text('下一关'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('第 1 册 · 第 100 关'), findsOneWidget);
    await tester.tap(find.byKey(const Key('game-exit')).last);
    await tester.pumpAndSettle();
    expect(find.text('准备好了吗，Navigator？'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('map level exit returns to the same map', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Map navigator',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    await tester.runAsync(
      () => controller.repository.loadLevel('nce-1997-b1-level-001'),
    );
    configurePhone(tester);
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        MaterialApp(
          home: MapScreen(
            controller: controller,
            curriculumId: 'nce-1997',
            initialTrackId: 'nce-1997-b1',
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 250));
      await tester.tap(find.bySemanticsLabel('第 1 关'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byKey(const Key('game-exit')).last);
      await tester.pumpAndSettle();

      expect(find.text('新概念英语地图'), findsOneWidget);
      expect(find.text('第 1 册'), findsWidgets);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('review level exit returns to review', (tester) async {
    final store = _MemoryLocalStore();
    final source = widgetController(store: store);
    await initializeController(tester, source);
    source.createProfile(
      nickname: 'Review navigator',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    source.recordWrong(
      levelId: 'nce-1997-b1-level-001',
      wordId: 'nce-1997-cat',
    );
    final saved = jsonDecode(store.value!) as Map<String, dynamic>;
    final profiles = saved['profiles'] as Map<String, dynamic>;
    final profile = profiles.values.single as Map<String, dynamic>;
    final review = profile['review'] as Map<String, dynamic>;
    (review['nce-1997-cat'] as Map<String, dynamic>)['dueAt'] = DateTime.utc(
      2020,
    ).toIso8601String();
    store.value = jsonEncode(saved);
    final controller = widgetController(store: store);
    await initializeController(tester, controller);
    await tester.runAsync(
      () => controller.repository.loadLevel('nce-1997-b1-level-001'),
    );
    configurePhone(tester);

    await tester.pumpWidget(
      MaterialApp(home: ReviewScreen(controller: controller)),
    );
    await tester.pump(const Duration(milliseconds: 250));
    await tester.tap(find.text('打开所在关卡'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.byKey(const Key('game-exit')).last);
    await tester.pumpAndSettle();

    expect(find.text('单词复习'), findsOneWidget);
    expect(find.text('打开所在关卡'), findsOneWidget);
  });

  testWidgets('direct level exit falls back to its own course map', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Deep link navigator',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    await tester.runAsync(
      () => controller.repository.loadLevel('ielts-nawl-v1-level-001'),
    );
    configurePhone(tester);

    await tester.pumpWidget(
      MaterialApp(
        home: GameScreen(
          controller: controller,
          levelId: 'ielts-nawl-v1-level-001',
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.byKey(const Key('game-exit')).last);
    await tester.pumpAndSettle();

    expect(find.text('IELTS 备考词汇地图'), findsOneWidget);
    expect(find.text('第 1 阶段'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('map exposes localized star semantics', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Tester',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    final bundle = await tester.runAsync(
      () => controller.repository.loadLevel('nce-1997-b1-level-001'),
    );
    controller.completeLevel(bundle!.level);
    configurePhone(tester);
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        MaterialApp(
          home: MapScreen(
            controller: controller,
            curriculumId: 'nce-1997',
            initialTrackId: 'nce-1997-b1',
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.bySemanticsLabel('第 1 关，3 星'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('stars')), findsNothing);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('map disables rated levels and exposes a localized lock', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController(
      ratings: const {'nce-1997-b1-level-001': '13-plus'},
    );
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Tester',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    configurePhone(tester);
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        MaterialApp(
          home: MapScreen(
            controller: controller,
            curriculumId: 'nce-1997',
            initialTrackId: 'nce-1997-b1',
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.bySemanticsLabel('第 1 关，未开放'), findsOneWidget);
      expect(find.byIcon(Icons.lock_outline_rounded), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets('result poster is 1080x1440-ready and excludes private fields', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'PRIVATE USER',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    configurePhone(tester);

    await tester.pumpWidget(
      MaterialApp(
        home: AssessmentResultScreen(
          controller: controller,
          result: assessmentResult(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final poster = find.byKey(const ValueKey('assessment-result-poster'));
    expect(poster, findsOneWidget);
    expect(tester.getSize(poster), const Size(360, 480));
    expect(find.textContaining('95% 估算区间：6,100–8,400'), findsWidgets);
    expect(find.text('雅思'), findsOneWidget);
    expect(find.text('基础高频词汇'), findsWidgets);
    expect(find.text('进阶／学术词汇'), findsWidgets);
    expect(find.text('目标阶段词汇'), findsWidgets);
    expect(find.textContaining('PRIVATE USER'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('assessment uses lowercase words without item-level feedback', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await initializeController(tester, controller);
    controller.createProfile(
      nickname: 'Tester',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    await tester.runAsync(
      () => controller.startAssessment(AssessmentAnchor.unrestricted),
    );
    configurePhone(tester);
    final firstWord = controller.currentAssessmentQuestion!.item.spelling;
    final semantics = tester.ensureSemantics();

    try {
      await tester.pumpWidget(
        MaterialApp(home: AssessmentScreen(controller: controller)),
      );
      await tester.pump();
      expect(firstWord, firstWord.toLowerCase());
      expect(find.text(firstWord), findsOneWidget);

      await tester.tap(find.text('认识'));
      await tester.pump();
      _expectNoAssessmentAnswerLeak();
      await tester.pump(const Duration(milliseconds: 120));
      await tester.pump();
      expect(controller.activeAssessmentSession!.responses, hasLength(1));
      _expectNoAssessmentAnswerLeak();
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  testWidgets(
    'invalid result still exposes a clear estimate range but no poster',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final controller = widgetController();
      await initializeController(tester, controller);
      controller.createProfile(
        nickname: 'Tester',
        ageBand: AgeBand.allAges,
        uiLanguage: UiLanguage.chinese,
      );
      configurePhone(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: AssessmentResultScreen(
            controller: controller,
            result: assessmentResult(
              reliability: AssessmentReliability.invalid,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('本次结果还不够稳定'), findsOneWidget);
      expect(find.textContaining('6,100–8,400'), findsOneWidget);
      expect(find.textContaining('7,200'), findsOneWidget);
      expect(find.text('保存结果海报'), findsNothing);
      expect(
        find.byKey(const ValueKey('assessment-result-poster')),
        findsNothing,
      );
      expect(tester.takeException(), isNull);
    },
  );
}

void _expectNoAssessmentAnswerLeak() {
  const forbidden =
      r'回答正确|回答错误|正确答案|错误答案|correct answer|wrong answer|incorrect';
  expect(
    find.textContaining(RegExp(forbidden, caseSensitive: false)),
    findsNothing,
  );
  expect(
    find.bySemanticsLabel(RegExp(forbidden, caseSensitive: false)),
    findsNothing,
  );
}
