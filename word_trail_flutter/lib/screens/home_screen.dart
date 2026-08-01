import 'package:flutter/material.dart';

import '../app_controller.dart';
import '../l10n/app_strings.dart';
import '../models/player_state.dart';
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
    final continueId = controller.continueLevelId;
    final match = RegExp(r'-b(\d)-level-(\d+)').firstMatch(continueId)!;
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
                      Text(
                        t('home.continue'),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        t('home.continueDesc', {
                          'book': int.parse(match.group(1)!),
                          'level': int.parse(match.group(2)!),
                        }),
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
                  subtitle: '200',
                  onTap: () =>
                      _push(context, MapScreen(controller: controller)),
                ),
                _QuickCard(
                  icon: Icons.family_restroom_rounded,
                  title: t('home.parent'),
                  subtitle: '${controller.completedLevelCount}',
                  onTap: () =>
                      _push(context, ParentScreen(controller: controller)),
                ),
                _QuickCard(
                  icon: Icons.settings_outlined,
                  title: t('home.settings'),
                  subtitle: profile.ageBand.value,
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
          for (var book = 1; book <= 4; book++) ...[
            _BookProgress(
              book: book,
              completed: controller.completedInBook(book),
              locked: !controller.canAccessBook(book),
              t: t,
              onTap: controller.canAccessBook(book)
                  ? () => _push(
                      context,
                      MapScreen(controller: controller, initialBook: book),
                    )
                  : null,
            ),
            if (book < 4) const SizedBox(height: 8),
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

class _BookProgress extends StatelessWidget {
  const _BookProgress({
    required this.book,
    required this.completed,
    required this.locked,
    required this.t,
    required this.onTap,
  });
  final int book;
  final int completed;
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
              Text(
                t('common.book', {'book': book}),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              LinearProgressIndicator(
                value: locked ? 0 : completed / 50,
                minHeight: 7,
                borderRadius: BorderRadius.circular(99),
                backgroundColor: const Color(0x332F1B13),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          locked ? t('common.locked') : '$completed/50',
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xCFFFE7B0),
          ),
        ),
      ],
    ),
  );
}
