import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/course.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';

class WordbookScreen extends StatefulWidget {
  const WordbookScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<WordbookScreen> createState() => _WordbookScreenState();
}

class _WordbookScreenState extends State<WordbookScreen> {
  late final Future<List<_WordbookEntry>> _entries = _loadEntries();

  Future<List<_WordbookEntry>> _loadEntries() async {
    final profile = widget.controller.activeProfile!;
    final wantedIds = <String>{
      ...profile.favoriteWordIds,
      for (final progress in profile.levels.values) ...progress.solvedWordIds,
    };
    if (wantedIds.isEmpty) return const <_WordbookEntry>[];

    final candidateLevelIds = <String>{
      for (final entry in profile.levels.entries)
        if (entry.value.solvedWordIds.isNotEmpty) entry.key,
      for (final item in profile.review.values) item.levelId,
    };
    final remainingFavoriteIds = Set<String>.of(profile.favoriteWordIds);
    final result = <String, _WordbookEntry>{};

    Future<void> readLevel(String levelId) async {
      if (result.length == wantedIds.length) return;
      final bundle = await widget.controller.repository.loadLevel(levelId);
      final track = widget.controller.catalog.track(bundle.level.trackId);
      for (final word in bundle.level.words) {
        if (!wantedIds.contains(word.id) || result.containsKey(word.id)) {
          continue;
        }
        final vocabulary = bundle.vocabulary[word.id];
        if (vocabulary == null) continue;
        result[word.id] = _WordbookEntry(
          levelId: levelId,
          track: track,
          word: word,
          vocabulary: vocabulary,
          solved:
              profile.levels[levelId]?.solvedWordIds.contains(word.id) == true,
        );
        remainingFavoriteIds.remove(word.id);
      }
    }

    for (final levelId in candidateLevelIds) {
      try {
        await readLevel(levelId);
      } on ArgumentError {
        // A stale local reference must not prevent the remaining wordbook
        // entries from loading.
      }
    }

    // Favorites are normally created from solved-word details. If an older
    // save contains an orphan favorite, locate it from the offline catalog.
    if (remainingFavoriteIds.isNotEmpty) {
      for (final level in widget.controller.catalog.levels) {
        if (candidateLevelIds.contains(level.id)) continue;
        await readLevel(level.id);
        if (remainingFavoriteIds.isEmpty) break;
      }
    }

    final entries = result.values.toList(growable: false)
      ..sort(
        (left, right) => left.word.word.toLowerCase().compareTo(
          right.word.word.toLowerCase(),
        ),
      );
    return entries;
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final profile = widget.controller.activeProfile!;
      final t = AppStrings(profile.uiLanguage);
      return AppShell(
        maxWidth: 820,
        appBar: AppBar(title: Text(t('wordbook.title'))),
        child: FutureBuilder<List<_WordbookEntry>>(
          future: _entries,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const SizedBox(
                height: 320,
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final entries = snapshot.data ?? const <_WordbookEntry>[];
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  t('wordbook.subtitle'),
                  style: const TextStyle(
                    color: Color(0xCFFFE7B0),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),
                if (entries.isEmpty)
                  TrailCard(
                    child: Column(
                      children: [
                        const Icon(
                          Icons.bookmarks_outlined,
                          size: 52,
                          color: AppColors.amber,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          t('wordbook.empty'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(height: 1.5),
                        ),
                      ],
                    ),
                  )
                else
                  for (var index = 0; index < entries.length; index++) ...[
                    _WordbookCard(
                      entry: entries[index],
                      t: t,
                      favorite: widget.controller.isFavorite(
                        entries[index].word.id,
                      ),
                      onFavorite: () => widget.controller.toggleFavorite(
                        entries[index].word.id,
                      ),
                    ),
                    if (index < entries.length - 1) const SizedBox(height: 10),
                  ],
              ],
            );
          },
        ),
      );
    },
  );
}

class _WordbookEntry {
  const _WordbookEntry({
    required this.levelId,
    required this.track,
    required this.word,
    required this.vocabulary,
    required this.solved,
  });

  final String levelId;
  final CourseTrack track;
  final TargetWord word;
  final VocabularyWord vocabulary;
  final bool solved;
}

class _WordbookCard extends StatelessWidget {
  const _WordbookCard({
    required this.entry,
    required this.t,
    required this.favorite,
    required this.onFavorite,
  });

  final _WordbookEntry entry;
  final AppStrings t;
  final bool favorite;
  final VoidCallback onFavorite;

  @override
  Widget build(BuildContext context) => TrailCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.word.word.toLowerCase(),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${entry.vocabulary.phonetic} · '
                    '${entry.vocabulary.partOfSpeech} · '
                    '${entry.vocabulary.cefr}',
                    style: const TextStyle(
                      color: AppColors.amber,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onFavorite,
              tooltip: favorite ? t('game.unfavorite') : t('game.favorite'),
              icon: Icon(
                favorite
                    ? Icons.bookmark_rounded
                    : Icons.bookmark_border_rounded,
                color: favorite ? AppColors.amber : null,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          '${t('game.englishMeaning')}: ${entry.word.englishClue}',
          style: const TextStyle(height: 1.45),
        ),
        const SizedBox(height: 4),
        Text(
          '${t('game.chineseMeaning')}: ${entry.word.chineseClue}',
          style: const TextStyle(height: 1.45),
        ),
        if (entry.vocabulary.example.isNotEmpty) ...[
          const SizedBox(height: 7),
          Text(
            '${t('game.example')}: ${entry.vocabulary.example}',
            style: const TextStyle(fontStyle: FontStyle.italic),
          ),
        ],
        const SizedBox(height: 8),
        Text(
          t.sourceLabel(entry.word.source, track: entry.track),
          style: const TextStyle(
            color: Color(0xBFFFE7B0),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            if (entry.solved)
              Chip(
                avatar: const Icon(Icons.check_circle_rounded, size: 17),
                label: Text(t('wordbook.solved')),
              ),
            if (favorite)
              Chip(
                avatar: const Icon(Icons.bookmark_rounded, size: 17),
                label: Text(t('wordbook.favorite')),
              ),
          ],
        ),
      ],
    ),
  );
}
