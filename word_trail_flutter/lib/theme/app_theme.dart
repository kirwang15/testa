import 'package:flutter/material.dart';

class AppColors {
  static const background = Color(0xFF160906);
  static const surface = Color(0xFF25100B);
  static const surfaceHigh = Color(0xFF34170E);
  static const wood = Color(0xFF7E2E0C);
  static const woodDark = Color(0xFF3B1207);
  static const cream = Color(0xFFFFE7B0);
  static const amber = Color(0xFFF7B94B);
  static const green = Color(0xFF146B50);
  static const red = Color(0xFFA83C37);
  static const blue = Color(0xFF2F728E);
}

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.amber,
    brightness: Brightness.dark,
    surface: AppColors.surface,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.background,
    fontFamilyFallback: const ['PingFang SC', 'Noto Sans CJK SC'],
    textTheme: const TextTheme(
      headlineLarge: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -1),
      headlineMedium: TextStyle(
        fontWeight: FontWeight.w900,
        letterSpacing: -0.5,
      ),
      titleLarge: TextStyle(fontWeight: FontWeight.w900),
      titleMedium: TextStyle(fontWeight: FontWeight.w800),
      bodyLarge: TextStyle(fontWeight: FontWeight.w600, height: 1.45),
      bodyMedium: TextStyle(fontWeight: FontWeight.w600, height: 1.4),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(44, 52),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(44, 48),
        foregroundColor: AppColors.cream,
        side: const BorderSide(color: Color(0x55FFE7B0)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
  );
}
