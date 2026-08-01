import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:word_trail_app/app_controller.dart';
import 'package:word_trail_app/main.dart';
import 'package:word_trail_app/models/player_state.dart';
import 'package:word_trail_app/screens/game_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('onboarding fits a phone without layout exceptions', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final controller = AppController();
    await controller.initialize();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(WordTrailApp(controller: controller));
    await tester.pumpAndSettle();

    expect(find.text('选择你的学习路线'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('game feedback stays in flow on a phone viewport', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final controller = AppController();
    await controller.initialize();
    controller.createProfile(
      nickname: 'Tester',
      ageBand: AgeBand.tenToTwelve,
      uiLanguage: UiLanguage.english,
    );
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: GameScreen(
          controller: controller,
          levelId: 'nce-1997-b1-level-001',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Current clue'), findsOneWidget);
    expect(find.text('Crossword board'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
