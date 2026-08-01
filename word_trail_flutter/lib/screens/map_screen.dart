import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../data/course_repository.dart';
import '../l10n/app_strings.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import 'game_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.controller, this.initialBook = 1});

  final AppController controller;
  final int initialBook;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late int _book = widget.initialBook;

  @override
  Widget build(BuildContext context) {
    final t = AppStrings(widget.controller.activeProfile!.uiLanguage);
    final current = widget.controller.continueLevelId;
    return AppShell(
      appBar: AppBar(title: Text(t('map.title'))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('map.subtitle'),
            style: const TextStyle(color: Color(0xCFFFE7B0)),
          ),
          const SizedBox(height: 16),
          SegmentedButton<int>(
            showSelectedIcon: false,
            segments: List.generate(4, (index) {
              final book = index + 1;
              return ButtonSegment(
                value: book,
                label: Text('$book'),
                icon: Icon(
                  widget.controller.canAccessBook(book)
                      ? Icons.menu_book_outlined
                      : Icons.lock_outline_rounded,
                  size: 18,
                ),
              );
            }),
            selected: {_book},
            onSelectionChanged: (selection) =>
                setState(() => _book = selection.first),
          ),
          const SizedBox(height: 16),
          if (!widget.controller.canAccessBook(_book))
            TrailCard(
              child: Row(
                children: [
                  const Icon(
                    Icons.lock_outline_rounded,
                    color: AppColors.amber,
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(t('home.lockedBook'))),
                ],
              ),
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.maxWidth >= 900
                    ? 10
                    : constraints.maxWidth >= 560
                    ? 8
                    : 5;
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: 50,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: 9,
                    crossAxisSpacing: 9,
                  ),
                  itemBuilder: (context, index) {
                    final level = index + 1;
                    final id = CourseRepository.levelId(_book, level);
                    final progress = widget.controller.progressFor(id);
                    final isCurrent = id == current;
                    return Semantics(
                      button: true,
                      label:
                          '${t('common.level', {'level': level})}${progress.completed ? ', ${progress.bestStars} stars' : ''}',
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => GameScreen(
                              controller: widget.controller,
                              levelId: id,
                              replay: progress.completed,
                            ),
                          ),
                        ),
                        child: Container(
                          constraints: const BoxConstraints(
                            minWidth: 44,
                            minHeight: 44,
                          ),
                          decoration: BoxDecoration(
                            color: progress.completed
                                ? AppColors.green
                                : isCurrent
                                ? AppColors.wood
                                : AppColors.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isCurrent
                                  ? AppColors.amber
                                  : const Color(0x33FFE7B0),
                              width: isCurrent ? 2 : 1,
                            ),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '$level',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              if (progress.completed)
                                Text(
                                  '★' * progress.bestStars,
                                  maxLines: 1,
                                  style: const TextStyle(
                                    fontSize: 9,
                                    color: AppColors.amber,
                                    height: 1,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
        ],
      ),
    );
  }
}
