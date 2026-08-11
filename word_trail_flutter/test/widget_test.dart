import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:word_trail_app/app_controller.dart';
import 'package:word_trail_app/main.dart';
import 'package:word_trail_app/models/player_state.dart';
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('onboarding fits a phone without layout exceptions', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final controller = widgetController();
    await controller.initialize();
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
    await controller.initialize();
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
    await controller.initialize();
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
    await controller.initialize();
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
          home: GameScreen(
            controller: controller,
            levelId: 'nce-1997-b1-level-001',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('1. 先阅读当前提示，再点击下方字母按钮。'), findsOneWidget);
      expect(find.bySemanticsLabel('填字棋盘'), findsOneWidget);
      expect(find.bySemanticsLabel('字母按钮 C'), findsWidgets);
      expect(find.bySemanticsLabel('Crossword board'), findsNothing);
      for (final letter in ['C', 'A', 'T']) {
        final button = find.bySemanticsLabel('字母按钮 $letter').first;
        await tester.ensureVisible(button);
        await tester.pumpAndSettle();
        await tester.tap(button);
        await tester.pump();
      }
      expect(find.text('3. 当前单词已经填满，现在点击“检查单词”。'), findsOneWidget);
      await tester.ensureVisible(find.text('检查单词'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('检查单词'));
      await tester.pumpAndSettle();

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
    await controller.initialize();
    controller.createProfile(
      nickname: 'Tester',
      ageBand: AgeBand.allAges,
      uiLanguage: UiLanguage.chinese,
    );
    final bundle = await controller.repository.loadLevel(
      'nce-1997-b1-level-001',
    );
    controller.completeLevel(bundle.level);
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
      await tester.pumpAndSettle();

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
    await controller.initialize();
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
      await tester.pumpAndSettle();

      expect(find.bySemanticsLabel('第 1 关，未开放'), findsOneWidget);
      expect(find.byIcon(Icons.lock_outline_rounded), findsOneWidget);
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });
}
