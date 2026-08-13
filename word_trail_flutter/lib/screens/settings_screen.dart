import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/player_state.dart';
import '../widgets/age_band_selector.dart';
import '../widgets/app_shell.dart';
import 'getting_started_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final current = controller.activeProfile!;
        final strings = AppStrings(current.uiLanguage);
        return AppShell(
          appBar: AppBar(title: Text(strings('settings.title'))),
          maxWidth: 760,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SettingBlock(
                title: strings('settings.interface'),
                child: SegmentedButton<UiLanguage>(
                  showSelectedIcon: false,
                  segments: [
                    ButtonSegment(
                      value: UiLanguage.english,
                      label: Text(strings('settings.english')),
                    ),
                    ButtonSegment(
                      value: UiLanguage.chinese,
                      label: Text(strings('settings.chinese')),
                    ),
                  ],
                  selected: {current.uiLanguage},
                  onSelectionChanged: (value) =>
                      controller.updatePreferences(uiLanguage: value.first),
                ),
              ),
              const SizedBox(height: 12),
              _SettingBlock(
                title: strings('settings.clue'),
                child: SegmentedButton<UiLanguage>(
                  showSelectedIcon: false,
                  segments: [
                    ButtonSegment(
                      value: UiLanguage.english,
                      label: Text(strings('settings.english')),
                    ),
                    ButtonSegment(
                      value: UiLanguage.chinese,
                      label: Text(strings('settings.chinese')),
                    ),
                  ],
                  selected: {current.clueLanguage},
                  onSelectionChanged: (value) =>
                      controller.updatePreferences(clueLanguage: value.first),
                ),
              ),
              const SizedBox(height: 12),
              _SettingBlock(
                title: strings('settings.age'),
                child: AgeBandSelector(
                  selected: current.ageBand,
                  strings: strings,
                  onChanged: (value) =>
                      controller.updatePreferences(ageBand: value),
                ),
              ),
              if (controller.profiles.length > 1) ...[
                const SizedBox(height: 12),
                _SettingBlock(
                  title: strings('settings.profile'),
                  child: DropdownButtonFormField<String>(
                    initialValue: current.id,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                    ),
                    items: controller.profiles
                        .map(
                          (item) => DropdownMenuItem(
                            value: item.id,
                            child: Text(
                              '${item.nickname} · ${strings.ageBandLabel(item.ageBand)}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) controller.switchProfile(value);
                    },
                  ),
                ),
              ],
              const SizedBox(height: 12),
              TrailCard(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => GettingStartedScreen(
                      controller: controller,
                      standalone: true,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.explore_outlined,
                      color: Color(0xFFFFC45E),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings('settings.guide'),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            strings('settings.guideDesc'),
                            style: const TextStyle(color: Color(0xBFFFE7B0)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              TrailCard(
                onTap: () => _showSources(context, strings),
                child: Row(
                  children: [
                    const Icon(
                      Icons.library_books_outlined,
                      color: Color(0xFFFFC45E),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings('settings.sources'),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            strings('settings.sourcesDesc'),
                            style: const TextStyle(color: Color(0xBFFFE7B0)),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              TrailCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      strings('settings.reset'),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      strings('settings.resetDesc'),
                      style: const TextStyle(color: Color(0xBFFFE7B0)),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFFFB4AB),
                        side: const BorderSide(color: Color(0x66FFB4AB)),
                      ),
                      onPressed: () => _confirmReset(context, strings),
                      icon: const Icon(Icons.delete_outline_rounded),
                      label: Text(strings('settings.reset')),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Center(
                child: Text(
                  strings('app.offline'),
                  style: const TextStyle(
                    color: Color(0x99FFE7B0),
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _confirmReset(BuildContext context, AppStrings t) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(t('settings.confirmReset')),
        content: Text(t('settings.resetDesc')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(t('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(t('settings.confirm')),
          ),
        ],
      ),
    );
    if (confirmed == true) await controller.resetActiveProfile();
  }

  Future<void> _showSources(BuildContext context, AppStrings t) =>
      showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(t('settings.sources')),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(t('settings.sourcesNce')),
                const SizedBox(height: 16),
                Text(t('settings.sourcesNawl')),
                const SizedBox(height: 8),
                Text(
                  t('settings.sourcesLicense'),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 16),
                Text(t('settings.sourcesIelts')),
                const SizedBox(height: 16),
                Text(t('settings.sourcesKaoyan')),
                const SizedBox(height: 8),
                Text(t('settings.sourcesNgsl')),
              ],
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: Text(t('settings.close')),
            ),
          ],
        ),
      );
}

class _SettingBlock extends StatelessWidget {
  const _SettingBlock({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => TrailCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        child,
      ],
    ),
  );
}
