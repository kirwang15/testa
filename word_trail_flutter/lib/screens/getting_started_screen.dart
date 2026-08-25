import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';

class GettingStartedScreen extends StatelessWidget {
  const GettingStartedScreen({
    super.key,
    required this.controller,
    this.standalone = false,
  });

  final AppController controller;
  final bool standalone;

  @override
  Widget build(BuildContext context) {
    final t = AppStrings(controller.activeProfile!.uiLanguage);
    if (standalone) return _ReferenceGuide(t: t);
    return AppShell(
      maxWidth: 760,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BrandMark(title: t('app.name'), compact: true),
          const SizedBox(height: 28),
          Semantics(
            header: true,
            child: Text(
              t('guide.title'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineLarge,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            t('guide.requiredBody'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xDFFFE7B0), fontSize: 16),
          ),
          const SizedBox(height: 22),
          TrailCard(
            highlighted: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.route_rounded,
                  size: 58,
                  color: AppColors.amber,
                ),
                const SizedBox(height: 16),
                _GuideLine(
                  icon: Icons.home_outlined,
                  text: t('guide.requiredHome'),
                ),
                _GuideLine(
                  icon: Icons.map_outlined,
                  text: t('guide.requiredMap'),
                ),
                _GuideLine(
                  icon: Icons.spellcheck_rounded,
                  text: t('guide.requiredGame'),
                ),
                _GuideLine(
                  icon: Icons.emoji_events_outlined,
                  text: t('guide.requiredComplete'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            key: const Key('tutorial-begin'),
            onPressed: controller.beginTutorial,
            icon: const Icon(Icons.arrow_forward_rounded),
            label: Text(t('guide.beginJourney')),
          ),
          const SizedBox(height: 8),
          TextButton(
            key: const Key('tutorial-later'),
            onPressed: controller.beginTutorial,
            child: Text(t('guide.later')),
          ),
          const SizedBox(height: 8),
          Text(
            t('guide.laterNote'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0x99FFE7B0), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _ReferenceGuide extends StatelessWidget {
  const _ReferenceGuide({required this.t});

  final AppStrings t;

  @override
  Widget build(BuildContext context) => AppShell(
    maxWidth: 760,
    appBar: AppBar(title: Text(t('settings.guide'))),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(t('guide.referenceIntro'), style: const TextStyle(fontSize: 16)),
        const SizedBox(height: 14),
        _ReferenceSection(
          icon: Icons.home_outlined,
          title: t('guide.referenceHomeTitle'),
          body: t('guide.referenceHomeBody'),
        ),
        const SizedBox(height: 10),
        _ReferenceSection(
          icon: Icons.map_outlined,
          title: t('guide.referenceMapTitle'),
          body: t('guide.referenceMapBody'),
        ),
        const SizedBox(height: 10),
        _ReferenceSection(
          icon: Icons.grid_view_rounded,
          title: t('guide.referenceGameTitle'),
          body: t('guide.referenceGameBody'),
        ),
        const SizedBox(height: 10),
        _ReferenceSection(
          icon: Icons.check_circle_outline_rounded,
          title: t('guide.referenceDetailTitle'),
          body: t('guide.referenceDetailBody'),
        ),
        const SizedBox(height: 10),
        _ReferenceSection(
          icon: Icons.emoji_events_outlined,
          title: t('guide.referenceCompleteTitle'),
          body: t('guide.referenceCompleteBody'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(t('guide.close')),
        ),
      ],
    ),
  );
}

class _GuideLine extends StatelessWidget {
  const _GuideLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.amber),
        const SizedBox(width: 12),
        Expanded(child: Text(text, style: const TextStyle(height: 1.45))),
      ],
    ),
  );
}

class _ReferenceSection extends StatelessWidget {
  const _ReferenceSection({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => TrailCard(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.amber, size: 30),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(body, style: const TextStyle(height: 1.5)),
            ],
          ),
        ),
      ],
    ),
  );
}
