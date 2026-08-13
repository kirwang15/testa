import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:word_trail_app/app_controller.dart';
import 'package:word_trail_app/main.dart';
import 'package:word_trail_app/models/assessment.dart';
import 'package:word_trail_app/models/player_state.dart';
import 'package:word_trail_app/screens/assessment_result_screen.dart';
import 'package:word_trail_app/screens/assessment_screen.dart';
import 'package:word_trail_app/screens/game_screen.dart';
import 'package:word_trail_app/screens/map_screen.dart';

import 'support/test_course_data.dart';

AppController widgetController({
  Map<String, String> ratings = const <String, String>{},
}) => AppController(repository: testCourseRepository(ratings: ratings));

void configurePhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

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

    expect(find.text('四步学会单词轨迹'), findsOneWidget);
    await tester.tap(find.text('暂时跳过'));
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

    expect(find.text('先选择课程'), findsOneWidget);
    await tester.tap(find.text('下一步'));
    await tester.pumpAndSettle();
    expect(find.text('再打开一关'), findsOneWidget);
    await tester.tap(find.text('下一步'));
    await tester.pumpAndSettle();
    expect(find.text('看提示，拼单词'), findsOneWidget);
    await tester.tap(find.text('下一步'));
    await tester.pumpAndSettle();
    expect(find.text('检查并继续'), findsOneWidget);
    await tester.tap(find.text('去首页开始'));
    await tester.pumpAndSettle();

    expect(controller.needsGettingStarted, isFalse);
    expect(find.text('从这里开始'), findsOneWidget);

    await tester.ensureVisible(find.text('设置'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('设置'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('新手指引'));
    await tester.pumpAndSettle();
    expect(find.text('新手指引'), findsOneWidget);
    await tester.tap(find.text('新手指引'));
    await tester.pumpAndSettle();
    expect(find.text('四步学会单词轨迹'), findsOneWidget);
    expect(find.text('先选择课程'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

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
      expect(find.text('3. 当前单词已经填满，现在点击“检查单词”。'), findsOneWidget);
      await tester.ensureVisible(find.text('检查单词'));
      await tester.pump(const Duration(milliseconds: 250));
      await tester.tap(find.text('检查单词'));
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.text('全部单词都完成了，做得好！'), findsOneWidget);
      expect(find.textContaining('Beta'), findsNothing);
      expect(find.textContaining('遮住棋盘'), findsNothing);
      expect(find.bySemanticsLabel('获得 3 星中的 3 星'), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
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

  testWidgets('assessment uses lowercase words and green/red answer feedback', (
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

    await tester.pumpWidget(
      MaterialApp(home: AssessmentScreen(controller: controller)),
    );
    await tester.pump();
    expect(firstWord, firstWord.toLowerCase());
    expect(find.text(firstWord), findsOneWidget);

    await tester.tap(find.text('认识'));
    await tester.pump();
    expect(find.text('回答正确'), findsOneWidget);
    final correctPanel = tester.widget<Container>(
      find
          .ancestor(of: find.text('回答正确'), matching: find.byType(Container))
          .first,
    );
    expect(
      (correctPanel.decoration! as BoxDecoration).color,
      const Color(0xFF176B45),
    );
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump();

    await tester.tap(find.text('不确定'));
    await tester.pump();
    expect(find.textContaining('回答错误'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pump();
    expect(tester.takeException(), isNull);
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
