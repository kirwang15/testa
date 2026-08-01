import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

enum GameFeedbackType { correct, wrong, hint, complete, neutral }

class GameFeedback {
  const GameFeedback(this.type, this.title, this.body);
  final GameFeedbackType type;
  final String title;
  final String body;
}

class FeedbackPanel extends StatelessWidget {
  const FeedbackPanel({super.key, required this.feedback});
  final GameFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final color = switch (feedback.type) {
      GameFeedbackType.correct || GameFeedbackType.complete => AppColors.green,
      GameFeedbackType.wrong => AppColors.red,
      GameFeedbackType.hint => const Color(0xFF926314),
      GameFeedbackType.neutral => AppColors.blue,
    };
    return Semantics(
      liveRegion: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white24),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              feedback.type == GameFeedbackType.wrong
                  ? Icons.refresh_rounded
                  : feedback.type == GameFeedbackType.hint
                  ? Icons.lightbulb_outline_rounded
                  : Icons.check_circle_outline_rounded,
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    feedback.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                    ),
                  ),
                  if (feedback.body.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      feedback.body,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
