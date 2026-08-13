import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';

class GettingStartedScreen extends StatefulWidget {
  const GettingStartedScreen({
    super.key,
    required this.controller,
    this.standalone = false,
  });

  final AppController controller;
  final bool standalone;

  @override
  State<GettingStartedScreen> createState() => _GettingStartedScreenState();
}

class _GettingStartedScreenState extends State<GettingStartedScreen> {
  static const _icons = <IconData>[
    Icons.auto_stories_rounded,
    Icons.play_circle_fill_rounded,
    Icons.spellcheck_rounded,
    Icons.emoji_events_rounded,
  ];

  int _step = 0;

  AppStrings get _strings =>
      AppStrings(widget.controller.activeProfile!.uiLanguage);

  void _finish() {
    if (widget.standalone) {
      Navigator.of(context).pop();
      return;
    }
    widget.controller.completeGettingStarted();
  }

  @override
  Widget build(BuildContext context) {
    final t = _strings;
    final last = _step == _icons.length - 1;
    return AppShell(
      maxWidth: 760,
      appBar: widget.standalone
          ? AppBar(title: Text(t('settings.guide')))
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!widget.standalone) ...[
            Row(
              children: [
                Expanded(child: BrandMark(title: t('app.name'), compact: true)),
                TextButton(onPressed: _finish, child: Text(t('guide.skip'))),
              ],
            ),
            const SizedBox(height: 28),
          ],
          Text(
            t('guide.title'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 7),
          Text(
            t('guide.subtitle'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xCFFFE7B0), fontSize: 16),
          ),
          const SizedBox(height: 22),
          _StepProgress(current: _step, total: _icons.length),
          const SizedBox(height: 14),
          Semantics(
            liveRegion: true,
            label: t('guide.stepOf', {
              'step': _step + 1,
              'total': _icons.length,
            }),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.04, 0),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              ),
              child: _GuideStepCard(
                key: ValueKey(_step),
                step: _step,
                icon: _icons[_step],
                title: t('guide.step${_step + 1}Title'),
                description: t('guide.step${_step + 1}Body'),
                t: t,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              if (_step > 0) ...[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _step -= 1),
                    icon: const Icon(Icons.arrow_back_rounded),
                    label: Text(t('guide.previous')),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                flex: _step > 0 ? 2 : 1,
                child: FilledButton.icon(
                  onPressed: last ? _finish : () => setState(() => _step += 1),
                  icon: Icon(
                    last
                        ? Icons.rocket_launch_rounded
                        : Icons.arrow_forward_rounded,
                  ),
                  label: Text(
                    last
                        ? widget.standalone
                              ? t('common.done')
                              : t('guide.start')
                        : t('guide.next'),
                  ),
                ),
              ),
            ],
          ),
          if (widget.standalone) ...[
            const SizedBox(height: 10),
            TextButton(onPressed: _finish, child: Text(t('guide.close'))),
          ],
        ],
      ),
    );
  }
}

class _StepProgress extends StatelessWidget {
  const _StepProgress({required this.current, required this.total});

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (var index = 0; index < total; index++) ...[
        Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            height: index == current ? 8 : 5,
            decoration: BoxDecoration(
              color: index <= current
                  ? AppColors.amber
                  : const Color(0x33FFE7B0),
              borderRadius: BorderRadius.circular(99),
            ),
          ),
        ),
        if (index < total - 1) const SizedBox(width: 7),
      ],
    ],
  );
}

class _GuideStepCard extends StatelessWidget {
  const _GuideStepCard({
    super.key,
    required this.step,
    required this.icon,
    required this.title,
    required this.description,
    required this.t,
  });

  final int step;
  final IconData icon;
  final String title;
  final String description;
  final AppStrings t;

  @override
  Widget build(BuildContext context) => TrailCard(
    highlighted: true,
    padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              color: AppColors.wood,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0x88F7B94B)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55200000),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Icon(icon, size: 36, color: AppColors.cream),
          ),
        ),
        const SizedBox(height: 18),
        Text(title, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text(
          description,
          style: const TextStyle(
            color: Color(0xDFFFE7B0),
            fontSize: 16,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 22),
        _StepPreview(step: step, t: t),
      ],
    ),
  );
}

class _StepPreview extends StatelessWidget {
  const _StepPreview({required this.step, required this.t});

  final int step;
  final AppStrings t;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0x66200000),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0x33FFE7B0)),
    ),
    child: switch (step) {
      0 => Row(
        children: [
          Expanded(
            child: _PreviewPill(
              icon: Icons.menu_book_rounded,
              label: t('guide.nce'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _PreviewPill(
              icon: Icons.school_rounded,
              label: t('guide.ielts'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _PreviewPill(
              icon: Icons.workspace_premium_rounded,
              label: t('guide.kaoyan'),
            ),
          ),
        ],
      ),
      1 => Row(
        children: [
          Expanded(
            child: _PreviewPill(
              icon: Icons.play_arrow_rounded,
              label: t('home.continue'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _PreviewPill(icon: Icons.map_outlined, label: t('home.map')),
          ),
        ],
      ),
      2 => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t('game.currentClue'),
            style: const TextStyle(
              color: AppColors.amber,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(t('guide.sampleClue')),
          const SizedBox(height: 12),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _LetterPreview('C'),
              SizedBox(width: 8),
              _LetterPreview('A'),
              SizedBox(width: 8),
              _LetterPreview('T'),
            ],
          ),
        ],
      ),
      _ => Row(
        children: [
          Expanded(
            child: _PreviewPill(
              icon: Icons.volume_up_outlined,
              label: t('game.listen'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _PreviewPill(
              icon: Icons.lightbulb_outline_rounded,
              label: t('game.hint'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _PreviewPill(
              icon: Icons.check_rounded,
              label: t('game.submit'),
            ),
          ),
        ],
      ),
    },
  );
}

class _PreviewPill extends StatelessWidget {
  const _PreviewPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(minHeight: 58),
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.surfaceHigh,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0x44F7B94B)),
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 22, color: AppColors.amber),
        const SizedBox(height: 5),
        Text(
          label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
        ),
      ],
    ),
  );
}

class _LetterPreview extends StatelessWidget {
  const _LetterPreview(this.letter);

  final String letter;

  @override
  Widget build(BuildContext context) => Container(
    width: 46,
    height: 46,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: AppColors.wood,
      shape: BoxShape.circle,
      border: Border.all(color: AppColors.amber),
    ),
    child: Text(
      letter,
      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
    ),
  );
}
