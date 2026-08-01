import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.child,
    this.appBar,
    this.maxWidth = 1180,
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 28),
  });

  final Widget child;
  final PreferredSizeWidget? appBar;
  final double maxWidth;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: appBar,
    body: SafeArea(
      top: appBar == null,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.4,
            colors: [Color(0xFF35160A), AppColors.background],
          ),
        ),
        child: Align(
          alignment: Alignment.topCenter,
          child: SingleChildScrollView(
            padding: padding,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: child,
            ),
          ),
        ),
      ),
    ),
  );
}

class TrailCard extends StatelessWidget {
  const TrailCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.onTap,
    this.highlighted = false,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final content = AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      padding: padding,
      decoration: BoxDecoration(
        color: highlighted ? const Color(0xFF3E2415) : AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: highlighted
              ? const Color(0x88F7B94B)
              : const Color(0x2EFFE7B0),
          width: highlighted ? 1.5 : 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return content;
    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: content,
      ),
    );
  }
}

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, required this.title, this.compact = false});

  final String title;
  final bool compact;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: compact ? 38 : 48,
        height: compact ? 38 : 48,
        decoration: BoxDecoration(
          color: AppColors.wood,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x88F7B94B)),
        ),
        child: const Icon(Icons.route_rounded, color: AppColors.cream),
      ),
      const SizedBox(width: 10),
      Text(
        title,
        style: TextStyle(
          fontSize: compact ? 17 : 21,
          fontWeight: FontWeight.w900,
          letterSpacing: 1,
        ),
      ),
    ],
  );
}

class MetricTile extends StatelessWidget {
  const MetricTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => TrailCard(
    child: Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: const Color(0x337E2E0C),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: AppColors.amber),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Text(
                label,
                style: const TextStyle(
                  color: Color(0xBFFFE7B0),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
