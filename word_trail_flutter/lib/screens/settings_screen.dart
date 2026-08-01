import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/player_state.dart';
import '../widgets/app_shell.dart';

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
                child: SegmentedButton<AgeBand>(
                  showSelectedIcon: false,
                  segments: AgeBand.values
                      .map(
                        (age) =>
                            ButtonSegment(value: age, label: Text(age.value)),
                      )
                      .toList(),
                  selected: {current.ageBand},
                  onSelectionChanged: (value) =>
                      controller.updatePreferences(ageBand: value.first),
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
                              '${item.nickname} · ${item.ageBand.value}',
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
