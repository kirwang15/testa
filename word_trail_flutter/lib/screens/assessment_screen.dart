import 'dart:async';

import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/assessment.dart';
import '../widgets/app_shell.dart';
import 'assessment_result_screen.dart';

class AssessmentScreen extends StatefulWidget {
  const AssessmentScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<AssessmentScreen> createState() => _AssessmentScreenState();
}

class _AssessmentScreenState extends State<AssessmentScreen> {
  final Stopwatch _responseClock = Stopwatch();
  Timer? _slowTimer;
  Timer? _lockTimer;
  bool _showSlowHint = false;
  bool _locked = false;
  bool _submitting = false;
  bool _showCarefulWarning = false;

  AppStrings get _t => AppStrings(widget.controller.activeProfile!.uiLanguage);

  @override
  void initState() {
    super.initState();
    widget.controller.resumeAssessment();
    _beginQuestionClock();
  }

  @override
  void dispose() {
    _slowTimer?.cancel();
    _lockTimer?.cancel();
    _responseClock.stop();
    super.dispose();
  }

  void _beginQuestionClock() {
    _slowTimer?.cancel();
    _responseClock
      ..reset()
      ..start();
    _showSlowHint = false;
    _slowTimer = Timer(const Duration(seconds: 30), () {
      if (mounted) setState(() => _showSlowHint = true);
    });
  }

  Future<void> _submit(AssessmentAnswer answer) async {
    if (_locked || _submitting) return;
    _submitting = true;
    _responseClock.stop();
    _slowTimer?.cancel();
    final step = widget.controller.submitAssessmentAnswer(answer);
    if (step.showCarefulAnswerWarning) {
      setState(() {
        _locked = true;
        _showCarefulWarning = true;
      });
      _lockTimer?.cancel();
      _lockTimer = Timer(step.lockInputFor, () {
        if (!mounted) return;
        setState(() {
          _locked = false;
          _showCarefulWarning = false;
        });
      });
    }
    if (step.session.isComplete) {
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => AssessmentResultScreen(
            controller: widget.controller,
            result: step.session,
          ),
        ),
      );
      return;
    }
    if (mounted) {
      setState(() {
        _submitting = false;
        _beginQuestionClock();
      });
    }
  }

  int get _elapsedMs => _responseClock.elapsedMilliseconds;

  Future<void> _askToPause() async {
    final shouldLeave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_t('assessment.pauseTitle')),
        content: Text(_t('assessment.pauseBody')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(_t('assessment.keepGoing')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(_t('assessment.pauseExit')),
          ),
        ],
      ),
    );
    if (shouldLeave == true && mounted) {
      widget.controller.pauseAssessment();
      Navigator.of(context).pop();
    }
  }

  ({double value, String label}) _progress(AssessmentSession session) {
    final count = session.responses.length;
    if (session.phase == AssessmentPhase.wrapUp || count >= 30) {
      return (value: 0.9, label: _t('assessment.progress.end'));
    }
    if (count >= 10) {
      return (value: 0.55, label: _t('assessment.progress.middle'));
    }
    return (value: 0.18, label: _t('assessment.progress.start'));
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.controller.activeAssessmentSession;
    final question = widget.controller.currentAssessmentQuestion;
    if (session == null || question == null) {
      return const SizedBox.shrink();
    }
    final progress = _progress(session);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _askToPause();
      },
      child: AppShell(
        maxWidth: 720,
        appBar: AppBar(
          leading: IconButton(
            onPressed: _askToPause,
            icon: const Icon(Icons.close_rounded),
            tooltip: _t('assessment.pauseTitle'),
          ),
          title: Text(_t('assessment.beta')),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              label: progress.label,
              value: progress.label,
              child: ExcludeSemantics(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    LinearProgressIndicator(
                      value: progress.value,
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(99),
                      backgroundColor: const Color(0x332F1B13),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      progress.label,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: Color(0x99FFE7B0),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 34),
            TrailCard(
              highlighted: true,
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
              child: Column(
                children: [
                  Text(
                    question.type == AssessmentQuestionType.yesNo
                        ? _t('assessment.yesNoPrompt')
                        : _t('assessment.choicePrompt'),
                    style: const TextStyle(color: Color(0xCFFFE7B0)),
                  ),
                  const SizedBox(height: 22),
                  Semantics(
                    header: true,
                    child: Text(
                      question.item.spelling.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 38,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            if (_showCarefulWarning)
              Semantics(
                liveRegion: true,
                label: _t('assessment.careful'),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4B3017),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    _t('assessment.careful'),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            if (_showCarefulWarning) const SizedBox(height: 12),
            if (question.type == AssessmentQuestionType.yesNo)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _locked || _submitting
                          ? null
                          : () => _submit(
                              AssessmentAnswer.yesNo(
                                recognized: false,
                                responseTimeMs: _elapsedMs,
                              ),
                            ),
                      child: Text(_t('assessment.no')),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: _locked || _submitting
                          ? null
                          : () => _submit(
                              AssessmentAnswer.yesNo(
                                recognized: true,
                                responseTimeMs: _elapsedMs,
                              ),
                            ),
                      child: Text(_t('assessment.yes')),
                    ),
                  ),
                ],
              )
            else
              for (
                var index = 0;
                index < question.item.options.length;
                index++
              ) ...[
                OutlinedButton(
                  onPressed: _locked || _submitting
                      ? null
                      : () => _submit(
                          AssessmentAnswer.multipleChoice(
                            selectedOptionIndex: index,
                            responseTimeMs: _elapsedMs,
                          ),
                        ),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(question.item.options[index]),
                  ),
                ),
                if (index < question.item.options.length - 1)
                  const SizedBox(height: 9),
              ],
            const SizedBox(height: 12),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: _showSlowHint
                  ? Column(
                      key: const ValueKey('slow-hint'),
                      children: [
                        Text(
                          _t('assessment.slowHint'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xBFFFE7B0)),
                        ),
                        TextButton(
                          onPressed: _locked || _submitting
                              ? null
                              : () => _submit(
                                  AssessmentAnswer.skipped(
                                    responseTimeMs: _elapsedMs,
                                  ),
                                ),
                          child: Text(_t('assessment.skip')),
                        ),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }
}
