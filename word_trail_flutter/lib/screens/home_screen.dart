import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/course.dart';
import '../theme/app_theme.dart';
import '../widgets/app_shell.dart';
import 'game_screen.dart';
import 'map_screen.dart';
import 'parent_screen.dart';
import 'review_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.controller});

  final AppController controller;

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final profile = controller.activeProfile!;
    final t = AppStrings(profile.uiLanguage);
    final curriculum = controller.activeCurriculum;
    final courseLevels = controller.catalog.levelsForCurriculum(curriculum.id);
    final continueId = controller.continueLevelId;
    final continueEntry = controller.catalog.level(continueId);
    final continueTrack = controller.catalog.track(continueEntry.trackId);
    return AppShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: BrandMark(title: t('app.name'), compact: true)),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 13,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: AppColors.woodDark,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: const Color(0x55FFE7B0)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.diamond_outlined,
                      size: 20,
                      color: AppColors.amber,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${profile.coins}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 26),
          Text(
            t('home.greeting', {'name': profile.nickname}),
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 5),
          Text(
            t('home.subtitle'),
            style: const TextStyle(color: Color(0xCFFFE7B0), fontSize: 16),
          ),
          const SizedBox(height: 20),
          Text(
            t('home.chooseCourse'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          LayoutBuilder(
            builder: (context, constraints) {
              final narrow = constraints.maxWidth < 620;
              final cards = controller.catalog.curricula
                  .map(
                    (item) => _CourseCard(
                      curriculum: item,
                      title: t.curriculumTitle(item),
                      selected: item.id == curriculum.id,
                      completed: controller.completedInCurriculum(item.id),
                      total: controller.catalog
                          .levelsForCurriculum(item.id)
                          .length,
                      t: t,
                      onTap: () => controller.selectCurriculum(item.id),
                    ),
                  )
                  .toList(growable: false);
              if (narrow) {
                return Column(
                  children: [
                    for (var index = 0; index < cards.length; index++) ...[
                      cards[index],
                      if (index < cards.length - 1) const SizedBox(height: 8),
                    ],
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var index = 0; index < cards.length; index++) ...[
                    Expanded(child: cards[index]),
                    if (index < cards.length - 1) const SizedBox(width: 10),
                  ],
                ],
              );
            },
          ),
          const SizedBox(height: 12),
          TrailCard(
            highlighted: true,
            onTap: () => _push(
              context,
              GameScreen(controller: controller, levelId: continueId),
            ),
            child: Row(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: AppColors.wood,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    size: 34,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (controller.completedLevelCount == 0) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.amber,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            t('guide.homeStart'),
                            style: const TextStyle(
                              color: AppColors.background,
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(height: 5),
                      ],
                      Text(
                        t('home.continue'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        t.levelLocation(
                          continueTrack,
                          continueEntry.levelNumber,
                        ),
                        style: const TextStyle(color: Color(0xCFFFE7B0)),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_rounded, color: AppColors.amber),
              ],
            ),
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final narrow = constraints.maxWidth < 620;
              final cards = [
                _QuickCard(
                  icon: Icons.refresh_rounded,
                  title: t('home.review'),
                  subtitle: t('home.reviewCount', {
                    'count': controller.dueReviewCount,
                  }),
                  onTap: () =>
                      _push(context, ReviewScreen(controller: controller)),
                ),
                _QuickCard(
                  icon: Icons.map_outlined,
                  title: t('home.map'),
                  subtitle: t('home.mapCount', {'count': courseLevels.length}),
                  onTap: () => _push(
                    context,
                    MapScreen(
                      controller: controller,
                      curriculumId: curriculum.id,
                    ),
                  ),
                ),
                _QuickCard(
                  icon: Icons.insights_outlined,
                  title: t('home.parent'),
                  subtitle: '${controller.completedLevelCount}',
                  onTap: () =>
                      _push(context, ParentScreen(controller: controller)),
                ),
                _QuickCard(
                  icon: Icons.settings_outlined,
                  title: t('home.settings'),
                  subtitle: t.ageBandLabel(profile.ageBand),
                  onTap: () =>
                      _push(context, SettingsScreen(controller: controller)),
                ),
              ];
              return GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: narrow ? 2 : 4,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: narrow ? 1.08 : 1.25,
                children: cards,
              );
            },
          ),
          const SizedBox(height: 22),
          Text(
            t('home.progress'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 10),
          for (
            var index = 0;
            index < controller.activeTracks.length;
            index++
          ) ...[
            _TrackProgress(
              track: controller.activeTracks[index],
              title: t.trackTitle(controller.activeTracks[index]),
              completed: controller.completedInTrack(
                controller.activeTracks[index].id,
              ),
              total: controller.catalog
                  .levelsForTrack(controller.activeTracks[index].id)
                  .length,
              locked: !controller.canAccessTrack(
                controller.activeTracks[index].id,
              ),
              t: t,
              onTap:
                  controller.canAccessTrack(controller.activeTracks[index].id)
                  ? () => _push(
                      context,
                      MapScreen(
                        controller: controller,
                        curriculumId: curriculum.id,
                        initialTrackId: controller.activeTracks[index].id,
                      ),
                    )
                  : null,
            ),
            if (index < controller.activeTracks.length - 1)
              const SizedBox(height: 8),
          ],
          const SizedBox(height: 16),
          Center(
            child: Text(
              t('app.offline'),
              style: const TextStyle(
                color: Color(0x99FFE7B0),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({
    required this.curriculum,
    required this.title,
    required this.selected,
    required this.completed,
    required this.total,
    required this.t,
    required this.onTap,
  });

  final Curriculum curriculum;
  final String title;
  final bool selected;
  final int completed;
  final int total;
  final AppStrings t;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => TrailCard(
    highlighted: selected,
    padding: const EdgeInsets.all(14),
    onTap: onTap,
    child: Row(
      children: [
        Icon(
          curriculum.id == AppController.defaultCurriculumId
              ? Icons.menu_book_rounded
              : Icons.school_rounded,
          color: AppColors.amber,
          size: 30,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 3),
              Text(
                t('home.courseProgress', {'done': completed, 'total': total}),
                style: const TextStyle(color: Color(0xBFFFE7B0), fontSize: 12),
              ),
            ],
          ),
        ),
        Icon(
          selected ? Icons.check_circle_rounded : Icons.circle_outlined,
          color: selected ? AppColors.amber : const Color(0x77FFE7B0),
        ),
      ],
    ),
  );
}

class _QuickCard extends StatelessWidget {
  const _QuickCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => TrailCard(
    padding: const EdgeInsets.all(14),
    onTap: onTap,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Icon(icon, color: AppColors.amber, size: 28),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(color: Color(0xBFFFE7B0), fontSize: 12),
            ),
          ],
        ),
      ],
    ),
  );
}

class _TrackProgress extends StatelessWidget {
  const _TrackProgress({
    required this.track,
    required this.title,
    required this.completed,
    required this.total,
    required this.locked,
    required this.t,
    required this.onTap,
  });
  final CourseTrack track;
  final String title;
  final int completed;
  final int total;
  final bool locked;
  final AppStrings t;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => TrailCard(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
    onTap: onTap,
    child: Row(
      children: [
        Icon(
          locked ? Icons.lock_outline_rounded : Icons.menu_book_rounded,
          color: locked ? const Color(0x77FFE7B0) : AppColors.amber,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              LinearProgressIndicator(
                value: locked || total == 0 ? 0 : completed / total,
                minHeight: 7,
                borderRadius: BorderRadius.circular(99),
                backgroundColor: const Color(0x332F1B13),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          locked ? t('common.locked') : '$completed/$total',
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xCFFFE7B0),
          ),
        ),
      ],
    ),
  );
}
