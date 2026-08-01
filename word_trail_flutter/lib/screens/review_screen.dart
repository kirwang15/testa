import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/course.dart';
import '../models/player_state.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import 'game_screen.dart';

class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  final _answerController = TextEditingController();
  int _index = 0;
  bool _wrong = false;

  @override
  void dispose() {
    _answerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.controller.activeProfile!;
    final t = AppStrings(profile.uiLanguage);
    final due = widget.controller.dueReviewItems;
    return AppShell(
      appBar: AppBar(title: Text(t('review.title'))),
      maxWidth: 720,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('review.subtitle'),
            style: const TextStyle(color: Color(0xCFFFE7B0)),
          ),
          const SizedBox(height: 18),
          if (due.isEmpty)
            TrailCard(
              child: Column(
                children: [
                  const Icon(
                    Icons.check_circle_outline_rounded,
                    color: AppColors.amber,
                    size: 52,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    t('review.empty'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ],
              ),
            )
          else
            FutureBuilder<_ReviewPrompt>(
              future: _loadPrompt(due[_index.clamp(0, due.length - 1)]),
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const TrailCard(
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                final prompt = snapshot.data!;
                final clue = profile.clueLanguage == UiLanguage.english
                    ? prompt.word.englishClue
                    : prompt.word.chineseClue;
                return TrailCard(
                  highlighted: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${_index + 1}/${due.length}',
                            style: const TextStyle(
                              color: AppColors.amber,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            t('game.length', {'length': prompt.word.length}),
                            style: const TextStyle(color: Color(0xBFFFE7B0)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        clue,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        t('game.source', {
                          'book': prompt.word.source.book,
                          'lesson': prompt.word.source.lesson,
                        }),
                        style: const TextStyle(
                          color: Color(0xBFFFE7B0),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 18),
                      TextField(
                        controller: _answerController,
                        autocorrect: false,
                        enableSuggestions: false,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          border: const OutlineInputBorder(),
                          labelText: t('game.submit'),
                          errorText: _wrong ? t('game.wrongBody') : null,
                        ),
                        onSubmitted: (_) => _check(prompt, due.length, t),
                      ),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: () => _check(prompt, due.length, t),
                        icon: const Icon(Icons.check_rounded),
                        label: Text(t('game.submit')),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => GameScreen(
                              controller: widget.controller,
                              levelId: prompt.debt.levelId,
                            ),
                          ),
                        ),
                        icon: const Icon(Icons.open_in_new_rounded),
                        label: Text(t('review.open')),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Future<_ReviewPrompt> _loadPrompt(ReviewDebt debt) async {
    final bundle = await widget.controller.repository.loadLevel(debt.levelId);
    final word = bundle.level.words.firstWhere(
      (item) => item.id == debt.wordId,
    );
    return _ReviewPrompt(debt, word);
  }

  void _check(_ReviewPrompt prompt, int total, AppStrings t) {
    if (_answerController.text.trim().toUpperCase() != prompt.word.word) {
      setState(() => _wrong = true);
      return;
    }
    widget.controller.completeReview(prompt.word.id);
    _answerController.clear();
    setState(() {
      _wrong = false;
      _index = _index >= total - 1 ? 0 : _index;
    });
  }
}

class _ReviewPrompt {
  const _ReviewPrompt(this.debt, this.word);
  final ReviewDebt debt;
  final TargetWord word;
}
