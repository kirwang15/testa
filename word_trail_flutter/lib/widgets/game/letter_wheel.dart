import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../../theme/app_theme.dart';

class LetterWheel extends StatelessWidget {
  const LetterWheel({
    super.key,
    required this.letters,
    required this.onLetter,
    required this.strings,
  });

  final List<String> letters;
  final ValueChanged<String> onLetter;
  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    const size = 238.0;
    const buttonSize = 44.0;
    const radius = 91.0;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              margin: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  colors: [Color(0xFF9A3B13), AppColors.woodDark],
                ),
                border: Border.all(color: const Color(0x882B0903), width: 5),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x66000000),
                    blurRadius: 22,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
            ),
          ),
          const Center(
            child: Icon(
              Icons.gesture_rounded,
              color: Color(0x99FFE7B0),
              size: 31,
            ),
          ),
          for (var index = 0; index < letters.length; index++)
            Positioned(
              left:
                  size / 2 +
                  math.cos(
                        (index / letters.length) * math.pi * 2 - math.pi / 2,
                      ) *
                      radius -
                  buttonSize / 2,
              top:
                  size / 2 +
                  math.sin(
                        (index / letters.length) * math.pi * 2 - math.pi / 2,
                      ) *
                      radius -
                  buttonSize / 2,
              width: buttonSize,
              height: buttonSize,
              child: Semantics(
                button: true,
                label: strings('semantics.letterButton', {
                  'letter': letters[index],
                }),
                child: ExcludeSemantics(
                  child: Material(
                    color: const Color(0xFFF8F3EA),
                    borderRadius: BorderRadius.circular(13),
                    elevation: 4,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(13),
                      onTap: () => onLetter(letters[index]),
                      child: Center(
                        child: Text(
                          letters[index],
                          style: const TextStyle(
                            color: Color(0xFF21130E),
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
