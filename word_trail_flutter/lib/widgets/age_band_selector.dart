import 'package:flutter/material.dart';

import '../l10n/app_strings.dart';
import '../models/player_state.dart';

class AgeBandSelector extends StatelessWidget {
  const AgeBandSelector({
    super.key,
    required this.selected,
    required this.strings,
    required this.onChanged,
  });

  final AgeBand selected;
  final AppStrings strings;
  final ValueChanged<AgeBand> onChanged;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: AgeBand.values
        .map(
          (ageBand) => ChoiceChip(
            label: Text(strings.ageBandLabel(ageBand)),
            selected: selected == ageBand,
            onSelected: (isSelected) {
              if (isSelected) onChanged(ageBand);
            },
          ),
        )
        .toList(growable: false),
  );
}
