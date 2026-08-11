import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/course.dart';
import '../models/player_state.dart';
import '../services/speech_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import '../widgets/game/crossword_board.dart';
import '../widgets/game/feedback_panel.dart';
import '../widgets/game/letter_wheel.dart';
import 'map_screen.dart';

class GameScreen extends StatefulWidget {
  const GameScreen({
    super.key,
    required this.controller,
    required this.levelId,
    this.replay = false,
  });

  final AppController controller;
  final String levelId;
  final bool replay;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  final SpeechService _speech = SpeechService();
  late final Future<LevelBundle> _bundleFuture = _load();
  final Map<GridPoint, String> _draft = {};
  final Set<String> _solved = {};
  final Map<String, int> _hintStage = {};
  final Set<String> _mistakeWords = {};
  String? _activeWordId;
  GameFeedback? _feedback;
  bool _attemptStarted = false;

  Future<LevelBundle> _load() async {
    if (!widget.controller.canAccessLevel(widget.levelId)) {
      throw ArgumentError.value(widget.levelId, 'levelId', 'Level is locked');
    }
    final bundle = await widget.controller.repository.loadLevel(widget.levelId);
    final progress = widget.controller.progressFor(widget.levelId);
    if (!widget.replay) _solved.addAll(progress.solvedWordIds);
    _activeWordId = bundle.level.words
        .firstWhere(
          (word) => !_solved.contains(word.id),
          orElse: () => bundle.level.words.first,
        )
        .id;
    if (!_attemptStarted) {
      _attemptStarted = true;
      widget.controller.beginAttempt(widget.levelId);
    }
    return bundle;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<LevelBundle>(
    future: _bundleFuture,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const AppShell(
          child: SizedBox(
            height: 520,
            child: Center(child: CircularProgressIndicator()),
          ),
        );
      }
      if (snapshot.hasError || !snapshot.hasData) {
        final language =
            widget.controller.activeProfile?.uiLanguage ?? UiLanguage.english;
        final t = AppStrings(language);
        return AppShell(
          appBar: AppBar(),
          child: TrailCard(child: Text(t('game.loadError'))),
        );
      }
      final bundle = snapshot.data!;
      return AnimatedBuilder(
        animation: widget.controller,
        builder: (context, _) => _buildGame(context, bundle),
      );
    },
  );

  Widget _buildGame(BuildContext context, LevelBundle bundle) {
    final profile = widget.controller.activeProfile!;
    final t = AppStrings(profile.uiLanguage);
    final level = bundle.level;
    final track = widget.controller.catalog.track(level.trackId);
    final activeWord = level.words.firstWhere(
      (word) => word.id == _activeWordId,
    );
    final progress = widget.controller.progressFor(level.id);
    final complete = _solved.length == level.words.length;
    final showBeginnerCoach =
        !widget.replay && widget.controller.completedLevelCount == 0;
    final beginnerCoachText = _beginnerCoachText(level, activeWord, t);
    return AppShell(
      maxWidth: 1240,
      appBar: AppBar(
        title: Text(t.levelLocation(track, level.levelNumber)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.woodDark,
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(color: const Color(0x44FFE7B0)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.diamond_outlined,
                      size: 18,
                      color: AppColors.amber,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '${profile.coins}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final desktop = constraints.maxWidth >= 900;
          final board = _BoardColumn(
            level: level,
            trackTitle: t.trackTitle(track),
            solved: _solved,
            draft: _draft,
            activeWordId: activeWord.id,
            inputLetters: _inputLetters(level, activeWord),
            progressText: t('game.progress', {
              'done': _solved.length,
              'total': level.words.length,
            }),
            onCellTap: (point) => _selectPoint(level, point),
            onLetter: (letter) => _addLetter(level, activeWord, letter),
            onDelete: () => _deleteLetter(level, activeWord),
            onClear: () => _clearWord(activeWord),
            onSubmit: complete ? null : () => _submit(level, activeWord, t),
            t: t,
          );
          final clue = _ClueColumn(
            level: level,
            track: track,
            bundle: bundle,
            activeWord: activeWord,
            solved: _solved,
            feedback: _feedback,
            progress: progress,
            t: t,
            clueLanguage: profile.clueLanguage,
            complete: complete,
            beginnerCoachText: showBeginnerCoach ? beginnerCoachText : null,
            onSelectWord: (id) => setState(() {
              _activeWordId = id;
              _feedback = null;
            }),
            onToggleLanguage: () => widget.controller.updatePreferences(
              clueLanguage: profile.clueLanguage == UiLanguage.english
                  ? UiLanguage.chinese
                  : UiLanguage.english,
            ),
            onListen: () => _listen(activeWord, bundle, t, recordHint: false),
            onHint: () => _useHint(level, activeWord, bundle, t),
            onReplay: () => _restart(level),
            onMap: () => Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (_) => MapScreen(
                  controller: widget.controller,
                  curriculumId: level.curriculumId,
                  initialTrackId: level.trackId,
                ),
              ),
            ),
            onNext: widget.controller.nextLevelId(level) == null
                ? null
                : () => Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => GameScreen(
                        controller: widget.controller,
                        levelId: widget.controller.nextLevelId(level)!,
                      ),
                    ),
                  ),
          );
          final gameContent = desktop
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 12, child: board),
                    const SizedBox(width: 18),
                    Expanded(flex: 8, child: clue),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [clue, const SizedBox(height: 16), board],
                );
          return gameContent;
        },
      ),
    );
  }

  String _beginnerCoachText(
    CourseLevel level,
    TargetWord activeWord,
    AppStrings t,
  ) {
    if (_feedback?.type == GameFeedbackType.wrong) {
      return t('guide.gameWrong');
    }
    if (_solved.isNotEmpty) return t('guide.gameSolved');
    final filled = activeWord.cells.every(
      (point) =>
          _fixedLetter(level, point) != null || _draft.containsKey(point),
    );
    if (filled) return t('guide.gameCheck');
    final hasInput = activeWord.cells.any(_draft.containsKey);
    return t(hasInput ? 'guide.gameTyping' : 'guide.gameStart');
  }

  void _selectPoint(CourseLevel level, GridPoint point) {
    final candidates = level.words
        .where((word) => word.cells.contains(point))
        .toList();
    if (candidates.isEmpty) return;
    final candidate = candidates.firstWhere(
      (word) => !_solved.contains(word.id),
      orElse: () => candidates.first,
    );
    setState(() {
      _activeWordId = candidate.id;
      _feedback = null;
    });
  }

  String? _fixedLetter(CourseLevel level, GridPoint point) {
    for (final word in level.words) {
      final index = word.cells.indexOf(point);
      if (index >= 0 && _solved.contains(word.id)) return word.word[index];
    }
    return null;
  }

  void _addLetter(CourseLevel level, TargetWord word, String letter) {
    for (final point in word.cells) {
      if (_fixedLetter(level, point) == null && !_draft.containsKey(point)) {
        setState(() {
          _draft[point] = letter;
          _feedback = null;
        });
        return;
      }
    }
  }

  void _deleteLetter(CourseLevel level, TargetWord word) {
    for (final point in word.cells.reversed) {
      if (_fixedLetter(level, point) == null && _draft.containsKey(point)) {
        setState(() {
          _draft.remove(point);
          _feedback = null;
        });
        return;
      }
    }
  }

  void _clearWord(TargetWord word) => setState(() {
    for (final point in word.cells) {
      _draft.remove(point);
    }
    _feedback = null;
  });

  void _submit(CourseLevel level, TargetWord word, AppStrings t) {
    final answer = word.cells
        .map((point) => _fixedLetter(level, point) ?? _draft[point] ?? '')
        .join();
    if (answer.length != word.length) {
      setState(
        () => _feedback = GameFeedback(
          GameFeedbackType.neutral,
          t('game.incomplete'),
          '',
        ),
      );
      return;
    }
    if (answer != word.word) {
      _mistakeWords.add(word.id);
      widget.controller.recordWrong(levelId: level.id, wordId: word.id);
      setState(
        () => _feedback = GameFeedback(
          GameFeedbackType.wrong,
          t('game.wrongTitle'),
          t('game.wrongBody'),
        ),
      );
      return;
    }
    widget.controller.recordCorrect(
      levelId: level.id,
      wordId: word.id,
      firstTry: !_mistakeWords.contains(word.id),
    );
    setState(() {
      _solved.add(word.id);
      for (final point in word.cells) {
        _draft.remove(point);
      }
      if (_solved.length == level.words.length) {
        widget.controller.completeLevel(level);
        _feedback = GameFeedback(
          GameFeedbackType.complete,
          t('game.completeTitle'),
          t('game.completeBody'),
        );
      } else {
        _feedback = GameFeedback(
          GameFeedbackType.correct,
          t('game.correctTitle'),
          t('game.correctBody'),
        );
        _activeWordId = level.words
            .firstWhere((candidate) => !_solved.contains(candidate.id))
            .id;
      }
    });
  }

  Future<void> _listen(
    TargetWord word,
    LevelBundle bundle,
    AppStrings t, {
    required bool recordHint,
  }) async {
    if (recordHint) {
      widget.controller.recordHint(levelId: bundle.level.id, wordId: word.id);
    }
    final didSpeak = await _speech.speak(word.word);
    if (!mounted || didSpeak) return;
    final phonetic = bundle.vocabulary[word.id]?.phonetic ?? '';
    setState(
      () => _feedback = GameFeedback(
        GameFeedbackType.hint,
        t('game.speechUnavailable', {'phonetic': phonetic}),
        '',
      ),
    );
  }

  Future<void> _useHint(
    CourseLevel level,
    TargetWord word,
    LevelBundle bundle,
    AppStrings t,
  ) async {
    final stage = _hintStage[word.id] ?? 0;
    _hintStage[word.id] = stage + 1;
    widget.controller.recordHint(levelId: level.id, wordId: word.id);
    if (stage == 0) {
      setState(
        () => _feedback = GameFeedback(
          GameFeedbackType.hint,
          t('game.hintAudio'),
          '',
        ),
      );
      await _speech.speak(word.word);
      return;
    }
    final candidates = word.cells
        .where(
          (point) =>
              _fixedLetter(level, point) == null && !_draft.containsKey(point),
        )
        .toList();
    if (candidates.isNotEmpty) {
      final point = candidates.first;
      final index = word.cells.indexOf(point);
      setState(() {
        _draft[point] = word.word[index];
        _feedback = GameFeedback(
          GameFeedbackType.hint,
          stage == 1 ? t('game.hintFirst') : t('game.hintPosition'),
          '',
        );
      });
    }
  }

  void _restart(CourseLevel level) {
    setState(() {
      _solved.clear();
      _draft.clear();
      _hintStage.clear();
      _mistakeWords.clear();
      _activeWordId = level.words.first.id;
      _feedback = null;
    });
    widget.controller.beginAttempt(level.id);
  }

  List<String> _inputLetters(CourseLevel level, TargetWord word) {
    final letters = word.word.split('');
    final targetCount = math.min(12, math.max(8, word.length + 2));
    for (final letter in level.letters) {
      if (letters.length >= targetCount) break;
      letters.add(letter);
    }
    final seed = word.id.codeUnits.fold(17, (value, unit) => value * 31 + unit);
    letters.shuffle(math.Random(seed));
    return letters;
  }
}

class _BoardColumn extends StatelessWidget {
  const _BoardColumn({
    required this.level,
    required this.trackTitle,
    required this.solved,
    required this.draft,
    required this.activeWordId,
    required this.inputLetters,
    required this.progressText,
    required this.onCellTap,
    required this.onLetter,
    required this.onDelete,
    required this.onClear,
    required this.onSubmit,
    required this.t,
  });

  final CourseLevel level;
  final String trackTitle;
  final Set<String> solved;
  final Map<GridPoint, String> draft;
  final String activeWordId;
  final List<String> inputLetters;
  final String progressText;
  final ValueChanged<GridPoint> onCellTap;
  final ValueChanged<String> onLetter;
  final VoidCallback onDelete;
  final VoidCallback onClear;
  final VoidCallback? onSubmit;
  final AppStrings t;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(trackTitle, style: Theme.of(context).textTheme.titleLarge),
          Text(
            progressText,
            style: const TextStyle(
              color: AppColors.amber,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
      const SizedBox(height: 10),
      CrosswordBoard(
        level: level,
        strings: t,
        solvedWordIds: solved,
        draftLetters: draft,
        activeWordId: activeWordId,
        onCellTap: onCellTap,
      ),
      const SizedBox(height: 14),
      Center(
        child: LetterWheel(
          letters: inputLetters,
          onLetter: onLetter,
          strings: t,
        ),
      ),
      const SizedBox(height: 10),
      Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        runSpacing: 8,
        children: [
          OutlinedButton.icon(
            onPressed: onClear,
            icon: const Icon(Icons.close_rounded),
            label: Text(t('game.clear')),
          ),
          OutlinedButton.icon(
            onPressed: onDelete,
            icon: const Icon(Icons.backspace_outlined),
            label: Text(t('game.delete')),
          ),
          FilledButton.icon(
            onPressed: onSubmit,
            icon: const Icon(Icons.check_rounded),
            label: Text(t('game.submit')),
          ),
        ],
      ),
    ],
  );
}

class _ClueColumn extends StatelessWidget {
  const _ClueColumn({
    required this.level,
    required this.track,
    required this.bundle,
    required this.activeWord,
    required this.solved,
    required this.feedback,
    required this.progress,
    required this.t,
    required this.clueLanguage,
    required this.complete,
    required this.beginnerCoachText,
    required this.onSelectWord,
    required this.onToggleLanguage,
    required this.onListen,
    required this.onHint,
    required this.onReplay,
    required this.onMap,
    required this.onNext,
  });

  final CourseLevel level;
  final CourseTrack track;
  final LevelBundle bundle;
  final TargetWord activeWord;
  final Set<String> solved;
  final GameFeedback? feedback;
  final LevelProgress progress;
  final AppStrings t;
  final UiLanguage clueLanguage;
  final bool complete;
  final String? beginnerCoachText;
  final ValueChanged<String> onSelectWord;
  final VoidCallback onToggleLanguage;
  final VoidCallback onListen;
  final VoidCallback onHint;
  final VoidCallback onReplay;
  final VoidCallback onMap;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final clue = clueLanguage == UiLanguage.english
        ? activeWord.englishClue
        : activeWord.chineseClue;
    final vocabulary = bundle.vocabulary[activeWord.id];
    final activeSolved = solved.contains(activeWord.id);
    return TrailCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('game.currentClue'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Semantics(
                      liveRegion: beginnerCoachText != null,
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 180),
                        child: Text(
                          beginnerCoachText ?? t('game.selectClue'),
                          key: ValueKey(beginnerCoachText),
                          style: TextStyle(
                            color: beginnerCoachText == null
                                ? const Color(0xBFFFE7B0)
                                : AppColors.amber,
                            fontSize: 12,
                            fontWeight: beginnerCoachText == null
                                ? FontWeight.w600
                                : FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.woodDark,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  '${solved.length}/${level.words.length}',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (var index = 0; index < level.words.length; index++) ...[
                  SizedBox(
                    height: 44,
                    child: ChoiceChip(
                      selected: activeWord.id == level.words[index].id,
                      avatar: solved.contains(level.words[index].id)
                          ? const Icon(Icons.check_circle_rounded, size: 17)
                          : null,
                      label: Text(
                        '${index + 1} · ${level.words[index].direction == WordDirection.across ? t('game.across') : t('game.down')} · ${level.words[index].length}',
                      ),
                      onSelected: (_) => onSelectWord(level.words[index].id),
                    ),
                  ),
                  if (index < level.words.length - 1) const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: const Color(0x66200000),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0x33FFE7B0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${activeWord.direction == WordDirection.across ? t('game.across') : t('game.down')} · ${t('game.length', {'length': activeWord.length})}',
                        style: const TextStyle(
                          color: AppColors.amber,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    SizedBox(
                      height: 44,
                      child: OutlinedButton.icon(
                        onPressed: onToggleLanguage,
                        icon: const Icon(Icons.translate_rounded, size: 18),
                        label: Text(
                          clueLanguage == UiLanguage.english
                              ? t('game.clueChinese')
                              : t('game.clueEnglish'),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  clue,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  t.sourceLabel(activeWord.source, track: track),
                  style: const TextStyle(
                    color: Color(0xBFFFE7B0),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (activeSolved && vocabulary != null) ...[
                  const Divider(height: 22),
                  Text(
                    '${vocabulary.partOfSpeech} · ${vocabulary.cefr} · ${vocabulary.phonetic}',
                    style: const TextStyle(
                      color: AppColors.amber,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (vocabulary.example.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(
                      vocabulary.example,
                      style: const TextStyle(fontStyle: FontStyle.italic),
                    ),
                  ],
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onListen,
                  icon: const Icon(Icons.volume_up_outlined),
                  label: Text(t('game.listen')),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: complete ? null : onHint,
                  icon: const Icon(Icons.lightbulb_outline_rounded),
                  label: Text(t('game.hint')),
                ),
              ),
            ],
          ),
          if (feedback != null) ...[
            const SizedBox(height: 10),
            FeedbackPanel(feedback: feedback!),
          ],
          if (complete) ...[
            const SizedBox(height: 12),
            Semantics(
              label: t('semantics.stars', {'stars': progress.bestStars}),
              child: ExcludeSemantics(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    progress.bestStars,
                    (_) => const Icon(
                      Icons.star_rounded,
                      color: AppColors.amber,
                      size: 30,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            if (onNext != null)
              FilledButton.icon(
                onPressed: onNext,
                icon: const Icon(Icons.arrow_forward_rounded),
                label: Text(t('game.next')),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onReplay,
                    child: Text(t('game.replay')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: onMap,
                    child: Text(t('game.toMap')),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
