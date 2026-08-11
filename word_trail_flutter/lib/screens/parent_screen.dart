import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';

class ParentScreen extends StatelessWidget {
  const ParentScreen({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final profile = controller.activeProfile!;
    final t = AppStrings(profile.uiLanguage);
    var firstTry = 0;
    var errors = 0;
    var hints = 0;
    for (final level in profile.levels.values) {
      firstTry += level.firstTryCorrect;
      errors += level.wrongAttempts;
      hints += level.hintCount;
    }
    final metrics = [
      (
        Icons.flag_outlined,
        t('parent.levels'),
        '${controller.completedLevelCount}',
      ),
      (Icons.check_circle_outline_rounded, t('parent.firstTry'), '$firstTry'),
      (Icons.close_rounded, t('parent.errors'), '$errors'),
      (Icons.lightbulb_outline_rounded, t('parent.hints'), '$hints'),
      (
        Icons.refresh_rounded,
        t('parent.reviews'),
        '${controller.dueReviewCount}',
      ),
      (
        Icons.calendar_today_outlined,
        t('parent.days'),
        '${profile.activeDates.length}',
      ),
    ];
    return AppShell(
      appBar: AppBar(title: Text(t('parent.title'))),
      maxWidth: 900,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('parent.subtitle'),
            style: const TextStyle(color: Color(0xCFFFE7B0)),
          ),
          const SizedBox(height: 18),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth > 700 ? 3 : 2;
              return GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: columns,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: constraints.maxWidth > 700 ? 2.2 : 1.35,
                children: metrics
                    .map(
                      (metric) => MetricTile(
                        icon: metric.$1,
                        label: metric.$2,
                        value: metric.$3,
                      ),
                    )
                    .toList(),
              );
            },
          ),
          const SizedBox(height: 18),
          TrailCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined, color: AppColors.amber),
                const SizedBox(width: 12),
                Expanded(child: Text(t('parent.privacy'))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
