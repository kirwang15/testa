import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/player_state.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _nicknameController = TextEditingController();
  AgeBand _ageBand = AgeBand.tenToTwelve;
  UiLanguage _language = UiLanguage.chinese;

  @override
  void dispose() {
    _nicknameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppStrings(_language);
    return AppShell(
      maxWidth: 760,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 22),
          Center(child: BrandMark(title: t('app.name'))),
          const SizedBox(height: 30),
          Text(
            t('onboarding.title'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 8),
          Text(
            t('onboarding.subtitle'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xCFFFE7B0), fontSize: 16),
          ),
          const SizedBox(height: 24),
          TrailCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _nicknameController,
                  maxLength: 18,
                  textInputAction: TextInputAction.done,
                  decoration: InputDecoration(
                    labelText: t('onboarding.nickname'),
                    prefixIcon: const Icon(Icons.person_outline_rounded),
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  t('onboarding.age'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 10),
                SegmentedButton<AgeBand>(
                  showSelectedIcon: false,
                  segments: AgeBand.values
                      .map(
                        (age) =>
                            ButtonSegment(value: age, label: Text(age.value)),
                      )
                      .toList(growable: false),
                  selected: {_ageBand},
                  onSelectionChanged: (value) =>
                      setState(() => _ageBand = value.first),
                ),
                const SizedBox(height: 20),
                _ModeCard(
                  selected: _language == UiLanguage.chinese,
                  icon: Icons.translate_rounded,
                  title: t('onboarding.guided'),
                  description: t('onboarding.guidedDesc'),
                  onTap: () => setState(() => _language = UiLanguage.chinese),
                ),
                const SizedBox(height: 10),
                _ModeCard(
                  selected: _language == UiLanguage.english,
                  icon: Icons.public_rounded,
                  title: t('onboarding.immersion'),
                  description: t('onboarding.immersionDesc'),
                  onTap: () => setState(() => _language = UiLanguage.english),
                ),
                const SizedBox(height: 22),
                FilledButton.icon(
                  onPressed: () => widget.controller.createProfile(
                    nickname: _nicknameController.text,
                    ageBand: _ageBand,
                    uiLanguage: _language,
                  ),
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: Text(t('onboarding.start')),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.shield_outlined,
                size: 18,
                color: AppColors.amber,
              ),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  t('app.offline'),
                  style: const TextStyle(
                    color: Color(0xBFFFE7B0),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.selected,
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => TrailCard(
    highlighted: selected,
    onTap: onTap,
    child: Row(
      children: [
        Icon(
          icon,
          color: selected ? AppColors.amber : AppColors.cream,
          size: 30,
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 3),
              Text(
                description,
                style: const TextStyle(color: Color(0xBFFFE7B0)),
              ),
            ],
          ),
        ),
        Icon(
          selected ? Icons.check_circle_rounded : Icons.circle_outlined,
          color: selected ? AppColors.amber : const Color(0x77FFE7B0),
        ),
      ],
    ),
  );
}
