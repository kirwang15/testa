import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/assessment.dart';
import '../services/poster_saver.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import 'assessment_intro_screen.dart';

class AssessmentResultScreen extends StatefulWidget {
  const AssessmentResultScreen({
    super.key,
    required this.controller,
    required this.result,
    this.posterSaver,
  });

  final AppController controller;
  final AssessmentSession result;
  final PosterSaver? posterSaver;

  @override
  State<AssessmentResultScreen> createState() => _AssessmentResultScreenState();
}

class _AssessmentResultScreenState extends State<AssessmentResultScreen> {
  final GlobalKey _posterKey = GlobalKey();
  bool _saving = false;

  AppStrings get _t => AppStrings(widget.controller.activeProfile!.uiLanguage);
  PosterSaver get _posterSaver =>
      widget.posterSaver ?? MethodChannelPosterSaver();

  String _number(int value) {
    final source = value.toString();
    if (source.length <= 3) return source;
    return '${source.substring(0, source.length - 3)},${source.substring(source.length - 3)}';
  }

  String _targetLabel() =>
      widget.result.selectedAnchor == AssessmentAnchor.unrestricted
      ? _t('assessment.profile.lowFrequency')
      : _t('assessment.profile.target');

  Future<void> _savePoster() async {
    if (_saving || widget.result.reliability == AssessmentReliability.invalid) {
      return;
    }
    setState(() => _saving = true);
    PosterSaveResult result;
    try {
      await WidgetsBinding.instance.endOfFrame;
      final boundary =
          _posterKey.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 3);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (data == null) throw StateError('PNG encoding failed');
      final date = widget.result.startedAt;
      result = await _posterSaver.savePng(
        data.buffer.asUint8List(),
        fileName:
            'word-trail-vocabulary-${date.year}${date.month.toString().padLeft(2, '0')}${date.day.toString().padLeft(2, '0')}.png',
      );
    } catch (_) {
      result = const PosterSaveResult(status: PosterSaveStatus.failed);
    }
    if (!mounted) return;
    setState(() => _saving = false);
    final message = switch (result.status) {
      PosterSaveStatus.saved => _t('assessment.posterSaved'),
      PosterSaveStatus.permissionDenied => _t('assessment.posterDenied'),
      _ => _t('assessment.posterFailed'),
    };
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _retest() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => AssessmentIntroScreen(controller: widget.controller),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final invalid = widget.result.reliability == AssessmentReliability.invalid;
    final profile = widget.result.coverageProfile;
    return AppShell(
      maxWidth: 760,
      appBar: AppBar(title: Text(_t('assessment.resultTitle'))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _t('assessment.rangeHeadline', {
              'lower': _number(widget.result.estimateLower),
              'upper': widget.result.estimateUpper >= 20000
                  ? '20,000+'
                  : _number(widget.result.estimateUpper),
            }),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 8),
          Text(
            _t('assessment.estimate', {
              'estimate': _number(widget.result.estimate),
            }),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xCFFFE7B0)),
          ),
          const SizedBox(height: 20),
          if (invalid) ...[
            TrailCard(
              highlighted: true,
              child: Column(
                children: [
                  const Icon(
                    Icons.refresh_rounded,
                    size: 48,
                    color: AppColors.amber,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _t('assessment.invalidTitle'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _t('assessment.invalidBody'),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ] else ...[
            _CoverageCard(values: profile, targetLabel: _targetLabel(), t: _t),
            const SizedBox(height: 18),
            Center(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: RepaintBoundary(
                  key: _posterKey,
                  child: _ResultPoster(
                    result: widget.result,
                    values: profile,
                    targetLabel: _targetLabel(),
                    t: _t,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _saving ? null : _savePoster,
              icon: const Icon(Icons.download_rounded),
              label: Text(
                _saving
                    ? _t('assessment.savingPoster')
                    : _t('assessment.savePoster'),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Text(
            _t('assessment.betaNote'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0x99FFE7B0), fontSize: 12),
          ),
          const SizedBox(height: 18),
          OutlinedButton(
            onPressed: _retest,
            child: Text(_t('assessment.retest')),
          ),
          const SizedBox(height: 9),
          TextButton(
            onPressed: () =>
                Navigator.of(context).popUntil((route) => route.isFirst),
            child: Text(_t('assessment.home')),
          ),
        ],
      ),
    );
  }
}

class _CoverageCard extends StatelessWidget {
  const _CoverageCard({
    required this.values,
    required this.targetLabel,
    required this.t,
  });

  final Map<String, double> values;
  final String targetLabel;
  final AppStrings t;

  int _percent(String key) => ((values[key] ?? 0) * 100).round();

  @override
  Widget build(BuildContext context) => TrailCard(
    child: Column(
      children: [
        Text(
          t('assessment.profile'),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 14),
        Semantics(
          label: t('assessment.radarSemantics', {
            'basic': _percent('basic'),
            'advanced': _percent('advanced'),
            'target': _percent('target'),
          }),
          child: ExcludeSemantics(
            child: SizedBox.square(
              dimension: 180,
              child: CustomPaint(painter: VocabularyRadarPainter(values)),
            ),
          ),
        ),
        const SizedBox(height: 14),
        _metric(t('assessment.profile.basic'), _percent('basic')),
        _metric(t('assessment.profile.advanced'), _percent('advanced')),
        _metric(targetLabel, _percent('target')),
      ],
    ),
  );

  Widget _metric(String label, int value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text('$value%', style: const TextStyle(fontWeight: FontWeight.w900)),
      ],
    ),
  );
}

class VocabularyRadarPainter extends CustomPainter {
  VocabularyRadarPainter(this.values);

  final Map<String, double> values;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * 0.4;
    final axes = <Offset>[
      Offset(center.dx, center.dy - radius),
      Offset(center.dx + radius * 0.866, center.dy + radius * 0.5),
      Offset(center.dx - radius * 0.866, center.dy + radius * 0.5),
    ];
    final grid = Paint()
      ..color = const Color(0x55FFE7B0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final scale in const [0.33, 0.66, 1.0]) {
      final path = Path()
        ..moveTo(
          center.dx + (axes[0].dx - center.dx) * scale,
          center.dy + (axes[0].dy - center.dy) * scale,
        );
      for (final point in axes.skip(1)) {
        path.lineTo(
          center.dx + (point.dx - center.dx) * scale,
          center.dy + (point.dy - center.dy) * scale,
        );
      }
      path.close();
      canvas.drawPath(path, grid);
    }
    for (final point in axes) {
      canvas.drawLine(center, point, grid);
    }

    final scores = [
      (values['basic'] ?? 0).clamp(0.0, 1.0),
      (values['advanced'] ?? 0).clamp(0.0, 1.0),
      (values['target'] ?? 0).clamp(0.0, 1.0),
    ];
    final result = Path();
    for (var index = 0; index < axes.length; index++) {
      final point = Offset(
        center.dx + (axes[index].dx - center.dx) * scores[index],
        center.dy + (axes[index].dy - center.dy) * scores[index],
      );
      if (index == 0) {
        result.moveTo(point.dx, point.dy);
      } else {
        result.lineTo(point.dx, point.dy);
      }
    }
    result.close();
    canvas.drawPath(
      result,
      Paint()
        ..color = const Color(0x66F7B94B)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      result,
      Paint()
        ..color = AppColors.amber
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(covariant VocabularyRadarPainter oldDelegate) =>
      oldDelegate.values != values;
}

class _ResultPoster extends StatelessWidget {
  const _ResultPoster({
    required this.result,
    required this.values,
    required this.targetLabel,
    required this.t,
  });

  final AssessmentSession result;
  final Map<String, double> values;
  final String targetLabel;
  final AppStrings t;

  String _number(int value) => value >= 1000
      ? '${value ~/ 1000},${(value % 1000).toString().padLeft(3, '0')}'
      : '$value';

  int _percent(String key) => ((values[key] ?? 0) * 100).round();

  Widget _metric(String label, int value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: Color(0xCCFFE7B0), fontSize: 11),
          ),
        ),
        Text(
          '$value%',
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => Container(
    key: const ValueKey('assessment-result-poster'),
    width: 360,
    height: 480,
    padding: const EdgeInsets.all(28),
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0xFF4A210F), Color(0xFF160906)],
      ),
    ),
    child: Material(
      type: MaterialType.transparency,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('app.name'),
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 16),
          Text(
            t('assessment.estimate', {'estimate': _number(result.estimate)}),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            t(
              result.estimateUpper >= 20000
                  ? 'assessment.upperRange'
                  : 'assessment.range',
              {
                'lower': _number(result.estimateLower),
                'upper': _number(result.estimateUpper),
              },
            ),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xCCFFE7B0), fontSize: 11),
          ),
          const SizedBox(height: 4),
          Text(
            t('assessment.anchor.${result.selectedAnchor.name}'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xAAFFE7B0), fontSize: 11),
          ),
          const SizedBox(height: 2),
          Text(
            '${result.startedAt.year}.${result.startedAt.month.toString().padLeft(2, '0')}.${result.startedAt.day.toString().padLeft(2, '0')}',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xAAFFE7B0)),
          ),
          const SizedBox(height: 10),
          Center(
            child: SizedBox.square(
              dimension: 126,
              child: CustomPaint(painter: VocabularyRadarPainter(values)),
            ),
          ),
          const SizedBox(height: 8),
          _metric(t('assessment.profile.basic'), _percent('basic')),
          _metric(t('assessment.profile.advanced'), _percent('advanced')),
          _metric(targetLabel, _percent('target')),
          const Spacer(),
          Text(
            t('assessment.posterQuote'),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 14),
          Text(
            t('assessment.beta'),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0x99FFE7B0), fontSize: 11),
          ),
        ],
      ),
    ),
  );
}
