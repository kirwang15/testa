import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../../models/course.dart';
import '../../theme/app_theme.dart';

class CrosswordBoard extends StatelessWidget {
  const CrosswordBoard({
    super.key,
    required this.level,
    required this.strings,
    required this.solvedWordIds,
    required this.draftLetters,
    required this.activeWordId,
    required this.onCellTap,
  });

  final CourseLevel level;
  final AppStrings strings;
  final Set<String> solvedWordIds;
  final Map<GridPoint, String> draftLetters;
  final String activeWordId;
  final ValueChanged<GridPoint> onCellTap;

  @override
  Widget build(BuildContext context) {
    final cells = <GridPoint, List<TargetWord>>{};
    final numbers = <GridPoint, int>{};
    for (var index = 0; index < level.words.length; index++) {
      final word = level.words[index];
      numbers.putIfAbsent(word.start, () => index + 1);
      for (final point in word.cells) {
        cells.putIfAbsent(point, () => []).add(word);
      }
    }
    return Semantics(
      label: strings('semantics.board'),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final available = math.min(constraints.maxWidth, 620.0);
          // Grid cells may shrink on compact phones; action controls remain 44px.
          // This keeps the largest supported 11-column board inside its panel.
          final tile = math.min(
            54.0,
            math.max(24.0, (available - 28) / level.cols),
          );
          return Center(
            child: Container(
              padding: const EdgeInsets.all(13),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppColors.wood, AppColors.woodDark],
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xAA2B0903), width: 2),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x66000000),
                    blurRadius: 26,
                    offset: Offset(0, 14),
                  ),
                ],
              ),
              child: SizedBox(
                width: tile * level.cols,
                height: tile * level.rows,
                child: Stack(
                  children: [
                    for (var row = 0; row < level.rows; row++)
                      for (var col = 0; col < level.cols; col++)
                        if (cells.containsKey(GridPoint(row, col)))
                          Positioned(
                            left: col * tile,
                            top: row * tile,
                            width: tile,
                            height: tile,
                            child: _Tile(
                              point: GridPoint(row, col),
                              strings: strings,
                              size: tile,
                              words: cells[GridPoint(row, col)]!,
                              number: numbers[GridPoint(row, col)],
                              solvedWordIds: solvedWordIds,
                              activeWordId: activeWordId,
                              draft: draftLetters[GridPoint(row, col)],
                              onTap: () => onCellTap(GridPoint(row, col)),
                            ),
                          ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.point,
    required this.strings,
    required this.size,
    required this.words,
    required this.number,
    required this.solvedWordIds,
    required this.activeWordId,
    required this.draft,
    required this.onTap,
  });

  final GridPoint point;
  final AppStrings strings;
  final double size;
  final List<TargetWord> words;
  final int? number;
  final Set<String> solvedWordIds;
  final String activeWordId;
  final String? draft;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    String? fixedLetter;
    for (final word in words) {
      if (solvedWordIds.contains(word.id)) {
        fixedLetter = word.word[word.cells.indexOf(point)];
        break;
      }
    }
    final letter = fixedLetter ?? draft;
    final solved = fixedLetter != null;
    final active = words.any((word) => word.id == activeWordId);
    return Semantics(
      button: true,
      label: letter == null
          ? strings('semantics.emptyCell', {
              'row': point.row + 1,
              'col': point.col + 1,
            })
          : strings('semantics.letterCell', {
              'letter': letter,
              'row': point.row + 1,
              'col': point.col + 1,
            }),
      child: ExcludeSemantics(
        child: InkWell(
          onTap: onTap,
          child: Container(
            margin: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: solved
                  ? const Color(0xFFE3F4E8)
                  : letter != null
                  ? const Color(0xFFD8F1FD)
                  : const Color(0xFFF7F2E9),
              borderRadius: BorderRadius.circular(math.max(7, size * 0.18)),
              border: Border.all(
                color: active
                    ? const Color(0xFF48BDEB)
                    : const Color(0xFFD7C9B6),
                width: active ? 2.5 : 1,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x55000000),
                  blurRadius: 4,
                  offset: Offset(0, 3),
                ),
              ],
            ),
            child: Stack(
              children: [
                if (number != null)
                  Positioned(
                    left: 4,
                    top: 2,
                    child: Text(
                      '$number',
                      style: TextStyle(
                        color: const Color(0xFF42271A),
                        fontSize: math.max(8, size * 0.19),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                Center(
                  child: Text(
                    letter ?? '',
                    style: TextStyle(
                      color: const Color(0xFF21130E),
                      fontSize: math.max(18, size * 0.54),
                      height: 1,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
