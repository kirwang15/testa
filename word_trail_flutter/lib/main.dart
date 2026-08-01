import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'l10n/app_strings.dart';
import 'models/player_state.dart';
import 'screens/home_screen.dart';
import 'screens/onboarding_screen.dart';
import 'theme/app_theme.dart';
import 'widgets/app_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final controller = AppController();
  runApp(WordTrailApp(controller: controller));
  controller.initialize();
}

class WordTrailApp extends StatelessWidget {
  const WordTrailApp({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final language = controller.activeProfile?.uiLanguage;
      final strings = AppStrings(
        language ??
            (WidgetsBinding.instance.platformDispatcher.locale.languageCode ==
                    'zh'
                ? UiLanguage.chinese
                : UiLanguage.english),
      );
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        title: strings('app.name'),
        theme: buildAppTheme(),
        home: !controller.isReady
            ? AppShell(
                child: SizedBox(
                  height: 520,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(),
                        const SizedBox(height: 18),
                        Text(strings('app.loading')),
                      ],
                    ),
                  ),
                ),
              )
            : controller.hasProfile
            ? HomeScreen(controller: controller)
            : OnboardingScreen(controller: controller),
      );
    },
  );
}
