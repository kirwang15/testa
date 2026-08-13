import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/assessment.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import 'assessment_screen.dart';

class AssessmentIntroScreen extends StatefulWidget {
  const AssessmentIntroScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<AssessmentIntroScreen> createState() => _AssessmentIntroScreenState();
}

class _AssessmentIntroScreenState extends State<AssessmentIntroScreen> {
  AssessmentAnchor _anchor = AssessmentAnchor.unrestricted;
  bool _starting = false;

  AppStrings get _t => AppStrings(widget.controller.activeProfile!.uiLanguage);

  Future<void> _start() async {
    if (_starting) return;
    setState(() => _starting = true);
    await widget.controller.startAssessment(_anchor);
    if (!mounted) return;
    setState(() => _starting = false);
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => AssessmentScreen(controller: widget.controller),
      ),
    );
  }

  void _resume() {
    widget.controller.resumeAssessment();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => AssessmentScreen(controller: widget.controller),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AppShell(
    maxWidth: 760,
    appBar: AppBar(title: Text(_t('assessment.beta'))),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(
          Icons.psychology_alt_rounded,
          size: 62,
          color: AppColors.amber,
        ),
        const SizedBox(height: 14),
        Text(
          _t('assessment.introTitle'),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 10),
        Text(
          _t('assessment.introBody'),
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0xD7FFE7B0)),
        ),
        const SizedBox(height: 12),
        Semantics(
          label: _t('assessment.private'),
          child: Text(
            _t('assessment.private'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0x99FFE7B0), fontSize: 12),
          ),
        ),
        if (widget.controller.activeAssessmentSession != null) ...[
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _resume,
            icon: const Icon(Icons.play_arrow_rounded),
            label: Text(_t('assessment.resume')),
          ),
        ],
        const SizedBox(height: 24),
        Text(
          _t('assessment.chooseAnchor'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final anchor in AssessmentAnchor.values)
              ChoiceChip(
                selected: _anchor == anchor,
                label: Text(_t('assessment.anchor.${anchor.name}')),
                onSelected: (_) => setState(() => _anchor = anchor),
              ),
          ],
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _starting ? null : _start,
          child: _starting
              ? const SizedBox.square(
                  dimension: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(_t('assessment.start')),
        ),
        const SizedBox(height: 16),
        Text(
          _t('assessment.betaNote'),
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0x99FFE7B0), fontSize: 12),
        ),
      ],
    ),
  );
}
