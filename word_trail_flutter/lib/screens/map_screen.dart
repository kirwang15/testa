import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/player_state.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import 'game_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({
    super.key,
    required this.controller,
    required this.curriculumId,
    this.initialTrackId,
  });

  final AppController controller;
  final String curriculumId;
  final String? initialTrackId;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late String _trackId;

  @override
  void initState() {
    super.initState();
    final tracks = widget.controller.catalog.tracksFor(widget.curriculumId);
    _trackId = tracks.any((track) => track.id == widget.initialTrackId)
        ? widget.initialTrackId!
        : tracks.first.id;
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final t = AppStrings(controller.activeProfile!.uiLanguage);
    final curriculum = controller.catalog.curriculum(widget.curriculumId);
    final tracks = controller.catalog.tracksFor(widget.curriculumId);
    final track = controller.catalog.track(_trackId);
    final levels = controller.catalog.levelsForTrack(_trackId);
    final current = widget.curriculumId == controller.activeCurriculum.id
        ? controller.continueLevelId
        : null;
    final tutorial = controller.tutorialProgress;
    final tutorialOnMap =
        tutorial?.phase == TutorialPhase.courseMap &&
        controller.catalog.level(tutorial!.levelId).curriculumId ==
            widget.curriculumId;
    return AppShell(
      appBar: AppBar(
        title: Text(t('map.title', {'course': t.curriculumTitle(curriculum)})),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('map.subtitle', {
              'tracks': tracks.length,
              'levels': controller.catalog
                  .levelsForCurriculum(widget.curriculumId)
                  .length,
            }),
            style: const TextStyle(color: Color(0xCFFFE7B0)),
          ),
          const SizedBox(height: 16),
          if (tutorialOnMap) ...[
            TrailCard(
              key: const Key('tutorial-map-coach'),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              highlighted: true,
              child: Row(
                children: [
                  const Icon(Icons.touch_app_rounded, color: AppColors.amber),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t('guide.mapCoachTitle'),
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(t('guide.mapModules')),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SegmentedButton<String>(
              showSelectedIcon: false,
              segments: [
                for (final item in tracks)
                  ButtonSegment(
                    value: item.id,
                    label: Text(t.trackTitle(item)),
                    icon: Icon(
                      controller.canAccessTrack(item.id)
                          ? Icons.menu_book_outlined
                          : Icons.lock_outline_rounded,
                      size: 18,
                    ),
                  ),
              ],
              selected: {_trackId},
              onSelectionChanged: (selection) =>
                  setState(() => _trackId = selection.first),
            ),
          ),
          const SizedBox(height: 16),
          if (!controller.canAccessTrack(_trackId))
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
          else ...[
            Text(
              t.trackTitle(track),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
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
                  itemCount: levels.length,
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    mainAxisSpacing: 9,
                    crossAxisSpacing: 9,
                  ),
                  itemBuilder: (context, index) {
                    final entry = levels[index];
                    final progress = controller.progressFor(entry.id);
                    final accessible = controller.canAccessLevel(entry.id);
                    final isCurrent = entry.id == current;
                    final isTutorialLevel =
                        controller.hasActiveTutorial &&
                        tutorial?.levelId == entry.id;
                    final semanticLabel = !accessible
                        ? t('map.levelLocked', {'level': entry.levelNumber})
                        : progress.completed
                        ? t('map.levelStars', {
                            'level': entry.levelNumber,
                            'stars': progress.bestStars,
                          })
                        : t('map.levelOpen', {'level': entry.levelNumber});
                    return Semantics(
                      button: true,
                      label: semanticLabel,
                      child: ExcludeSemantics(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: accessible
                              ? () {
                                  if (tutorial?.levelId == entry.id &&
                                      tutorial?.phase ==
                                          TutorialPhase.courseMap) {
                                    controller.setTutorialPhase(
                                      TutorialPhase.gameUi,
                                      levelId: entry.id,
                                    );
                                  }
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => GameScreen(
                                        controller: controller,
                                        levelId: entry.id,
                                        replay:
                                            progress.completed &&
                                            !isTutorialLevel,
                                        returnContext: GameReturnContext(
                                          source: isTutorialLevel
                                              ? GameEntrySource.tutorial
                                              : GameEntrySource.map,
                                          curriculumId: widget.curriculumId,
                                          trackId: _trackId,
                                        ),
                                      ),
                                    ),
                                  );
                                }
                              : null,
                          child: Container(
                            constraints: const BoxConstraints(
                              minWidth: 44,
                              minHeight: 44,
                            ),
                            decoration: BoxDecoration(
                              color: !accessible
                                  ? AppColors.surface.withValues(alpha: 0.45)
                                  : progress.completed
                                  ? AppColors.green
                                  : isCurrent
                                  ? AppColors.wood
                                  : AppColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isCurrent && accessible
                                    ? AppColors.amber
                                    : const Color(0x33FFE7B0),
                                width: isCurrent && accessible ? 2 : 1,
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                if (!accessible)
                                  const Icon(
                                    Icons.lock_outline_rounded,
                                    size: 18,
                                    color: Color(0x99FFE7B0),
                                  )
                                else
                                  Text(
                                    '${entry.levelNumber}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                if (accessible && progress.completed)
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
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
