import 'package:flutter_test/flutter_test.dart';
import 'package:word_trail_app/l10n/app_strings.dart';
import 'package:word_trail_app/models/player_state.dart';

void main() {
  test('completion feedback uses natural product language', () {
    expect(
      const AppStrings(UiLanguage.chinese)('game.completeBody'),
      '全部单词都完成了，做得好！',
    );
    expect(
      const AppStrings(UiLanguage.english)('game.completeBody'),
      'Every word is complete—great work!',
    );
  });

  test('user-facing copy rejects QA and internal release terminology', () {
    final visibleCopy = AppStrings.allUserVisibleText.join('\n');
    for (final denied in AppStrings.deniedUserFacingTerms) {
      expect(visibleCopy, isNot(contains(denied)), reason: denied);
    }
  });

  test('assessment duration and review action copy match policy v2', () {
    final visibleCopy = AppStrings.allUserVisibleText.join('\n');
    expect(visibleCopy, isNot(contains('3–5')));
    expect(visibleCopy, isNot(contains('under 40 questions')));
    expect(visibleCopy, isNot(contains('不超过 40 题')));
    expect(
      const AppStrings(UiLanguage.english)('assessment.homeStart'),
      '6–10 minute vocabulary check',
    );
    expect(
      const AppStrings(UiLanguage.chinese)('assessment.homeStartDesc'),
      contains('52–80 题'),
    );
    expect(const AppStrings(UiLanguage.chinese)('review.submit'), '检查答案');
    expect(visibleCopy, isNot(contains('检查单词')));
    expect(visibleCopy, isNot(contains('Check word')));
  });
}
