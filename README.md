# Word Trail Learning Platform

A beginner-friendly vocabulary learning platform built with Next.js App Router, TypeScript, Tailwind CSS, Zustand, and localStorage.

The product is now **learning-first, game-second**:

- vocabulary books and units provide the study structure
- generated levels provide puzzle practice
- the gameplay engine stays independent from the learning engine
- all progress lives locally with no backend or auth

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Useful commands

```bash
npm run typecheck
npm run test
npm run build
```

## Current architecture

```text
app/                  Next.js routes
components/           Reusable UI and gameplay components
lib/                  App-facing loaders, progress, storage helpers
src/content/          Vocabulary registry and mock book files
src/lib/              Pure engines and learning logic
store/                Zustand persistence layer
tests/                Lightweight automated tests
types/                Shared TypeScript contracts
```

## Vocabulary architecture

The primary content hierarchy is:

```text
Book
  -> Unit
      -> Vocabulary Words
          -> Generated Levels
```

### Runtime layers

1. `src/content/vocabulary/*.mock.ts`
   - authoring source of truth
   - nested book -> unit -> words
2. `src/lib/vocabulary-loader.ts`
   - normalizes books, units, and words
   - builds lookup maps
   - resolves levels from vocabulary words
3. `src/lib/level-generator.ts`
   - turns vocabulary words into deterministic playable levels
4. `lib/levelLoader.ts`
   - resolves the recommended level order and UI-facing status

### Vocabulary file schema

```ts
type VocabularyImportBook = {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  estimatedWordCount?: number;
  colorTheme?: "mint" | "coral" | "leaf" | "gold";
  units: VocabularyImportUnit[];
};

type VocabularyImportUnit = {
  id: string;
  title: string;
  lessonRange?: string;
  difficulty: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  estimatedMinutes?: number;
  words: VocabularyImportWord[];
};

type VocabularyImportWord = {
  id: string;
  word: string;
  displayText?: string;
  englishMeaning?: string;
  meaning?: string;
  chineseMeaning?: string;
  phonetic?: string;
  partOfSpeech?: string;
  difficulty?: number;
  cefrLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  frequencyRank?: number;
  examples?: string[];
  tags?: string[];
  learningConcept?: string;
};
```

`meaning` is kept as a legacy import field. The loader normalizes it into `englishMeaning`, so new content should prefer `englishMeaning` directly.

### Meaning display behavior

- word explanations default to **English**
- tapping a meaning switches that one word between `EN` and `中文`
- each word card keeps its own local toggle state
- if `englishMeaning` is missing, the UI falls back to `meaning` or the gameplay clue
- if `chineseMeaning` is missing, the UI keeps showing English
- if both are missing, the UI shows `No explanation available`

The mock files contain **placeholder / mock vocabulary only**. Do not add real textbook content unless it is properly licensed or user-owned.

## Learning architecture

The learning engine lives in `src/lib/learning-engine.ts`.

It tracks per-word progress:

- mastery level
- correct count
- wrong count
- streak
- favorite
- difficult
- current review reasons (`wrong` and/or `clue`)
- last reviewed
- next review

Core functions:

- `markWordCorrect()`
- `markWordWrong()`
- `markWordClueUsed()`
- `completeWordReview()`
- `updateMastery()`
- `toggleFavoriteWord()`
- `setWordDifficult()`
- `getFavoriteWords()`
- `getDifficultWords()`
- `getMasteredWords()`

### Current mastery defaults

- mastery is an integer from `0` to `5`
- a solved word increases mastery
- a wrong review answer lowers mastery by `1`
- using hints marks a word as difficult
- a later crossword answer does not erase an existing review reason
- review debt is cleared only after the learner spells the item correctly in `/review`
- mastered means `masteryLevel >= 4`

## Review architecture

The review prep layer lives in `src/lib/review-engine.ts`.

It provides:

- `scheduleNextReview()`
- `getDueWords()`
- `buildReviewQueue()`
- `getDailyReviewList()`

Current interval defaults:

- mastery `0` or `1`: review next day
- mastery `2`: review in 3 days
- mastery `3`: review in 7 days
- mastery `4`: review in 14 days
- mastery `5`: review in 30 days

`/review` is an answer-safe local practice session: it shows meaning, length, and pronunciation help, accepts keyboard spelling, keeps wrong input for another try, and reveals the headword only after a correct submission. Historical correct/wrong counts remain after the current review debt is cleared.

This is intentionally simple and deterministic, not a full advanced SRS implementation yet.

## Progress architecture

Local progress is persisted in `localStorage` through the Zustand store.

Persisted:

- coins
- current book / unit / level
- legacy-compatible `unlockedLevelIds`
- level progress
- word learning progress
- study statistics

Derived at runtime:

- recommended next level
- book completion %
- unit completion %
- learned words
- mastered words
- difficult words
- daily review queue

`totalWordsLearned` counts only words with at least one correct answer. A guessed-but-never-solved item can become review debt, but it does not inflate the learned total.

Home, book, and unit summaries share the same metric selector: learned and mastered items require a correct answer, while difficult counts only active review debt. Answer-safety filtering controls whether a headword chip may be shown; it does not change these numeric totals.

### Study statistics

The current stats model tracks:

- total words learned
- total words mastered
- total study minutes
- study streak

Study minutes are currently calculated with a simple rule:

- first completion of a level adds `unit.estimatedMinutes / levelCount`

## Level generation flow

The deterministic generator lives in `src/lib/level-generator.ts`.

Exports:

- `generateLevelsFromUnit()`
- `generateLevelsFromBook()`
- `generateLevelsFromVocabularySet()`
- `generateLevelFromWords()`
- `normalizeWord()`
- `createLetterPool()`

### Learning mode

- avoids repeated normalized words
- avoids repeated meanings close together
- avoids repeated learning concepts close together
- uses a default uniqueness window of `2` levels

### Review mode

- allows repeated words across generated review sets
- still keeps generation deterministic

### Current generator limitations

- no advanced crossword construction yet
- one target word per row in generated levels
- no seeded random generation yet

## Uniqueness system

`src/lib/vocabulary-uniqueness.ts` validates and indexes:

- duplicate book ids
- duplicate unit ids
- duplicate word ids
- duplicate normalized words
- duplicate Chinese meanings
- duplicate learning concepts

Conflict policy:

- duplicate ids: later duplicates are ignored
- duplicate words / meanings / concepts: issues are reported, but data still loads
- learning-mode generation filters using the uniqueness rules

## Jump system

The platform supports both **structured progression** and **free exploration**.

### Recommended path

- registry order defines the suggested path
- the first incomplete level in the global sequence becomes the recommendation
- UI marks books, units, and levels as:
  - `Completed`
  - `Recommended`
  - `Available`

### Free play

- all books, units, and levels are directly accessible
- jumping ahead does not break progress tracking
- entering a later level shows:
  - `This level may contain more advanced vocabulary.`

## Gameplay architecture

The crossword gameplay engine stays independent in `src/lib/game-engine.ts`.

It still owns:

- grid building
- word validation
- duplicate rejection
- level completion
- staged hint reveal
- completion rewards

The learning engine does **not** own gameplay rules.

Current integration:

- solving a target word updates word learning progress
- pronunciation → first hidden position → later positions is persisted per target
- hints are always available and never spend coins; they only affect stars
- failed speech playback does not count as a hint unless a visible phonetic fallback is shown
- speech requests settle from browser `onstart` / `onerror` events; stale callbacks from a solved word, changed route, newer request, or unmounted screen are ignored
- using a reveal marks only the related word for review
- a uniquely attributable near-miss increments that word’s historical `wrongCount`; ambiguous misses remain only in the level-wide error total
- duplicate answers are tracked separately from wrong attempts
- unit vocabulary previews use the same normalized-spelling gate as home favorites and difficult chips; unresolved entries show only a numbered locked clue, length, and sanitized meanings

Review submissions accept only `wordId + attempt`. The expected spelling is resolved from the registered local vocabulary; unknown ids fail closed, so UI callers cannot inject an answer to clear review debt.

## Local parent data controls

Progress stays on the current device. Destructive reset is isolated under `/settings`; it requires opening the parent data section, choosing reset, and typing `ERASE` before the final button becomes available. This is an intent barrier with keyboard focus and live announcements, not account authentication or a PIN.

## Word detail architecture prep

The system now prepares word-detail data with:

- `getWordDetailViewModel(wordId, progress)`

This is enough to support a future word modal or dedicated word page showing:

- word
- phonetic
- englishMeaning / chineseMeaning
- examples
- mastery
- favorite status

## AI extension prep

`src/lib/ai-interfaces.ts` defines future-facing contracts for:

- AI word explanations
- AI example generation
- AI coaching messages

No AI product logic is implemented yet.

## How to add a new vocabulary book

1. Create a new file under `src/content/vocabulary/`
2. Export one `VocabularyImportBook`
3. Register it in `src/content/vocabulary/index.ts`

Example:

```ts
export const ieltsCoreMock: VocabularyImportBook = {
  id: "ielts-core",
  title: "IELTS Core Vocabulary",
  subtitle: "Academic Practice",
  description: "Mock data only.",
  level: "B2",
  estimatedWordCount: 40,
  colorTheme: "leaf",
  units: []
};
```

## How to add a new unit

Inside the book file, add:

```ts
{
  id: "ielts-core-u1",
  title: "Unit 1: Education Topics",
  lessonRange: "Set 1",
  difficulty: "B2",
  estimatedMinutes: 18,
  words: []
}
```

## How to add a new word list

Each unit word should look like:

```ts
{
  id: "ielts-core-u1-analyze",
  word: "analyze",
  displayText: "analyze",
  englishMeaning: "to study something carefully",
  chineseMeaning: "分析",
  phonetic: "/ˈænəlaɪz/",
  partOfSpeech: "verb",
  difficulty: 2,
  cefrLevel: "B2",
  frequencyRank: 1200,
  examples: ["Students analyze data in class."],
  tags: ["academic", "education"],
  learningConcept: "academic_analysis"
}
```

## How to add complete New Concept vocabulary later

1. Keep the same book ids:
   - `nce-1`
   - `nce-2`
   - `nce-3`
   - `nce-4`
2. Replace or expand the mock word lists with licensed or user-owned data
3. Keep the same schema so the loader, generator, progress system, and UI do not need to change

## How to add IELTS / TOEFL / GRE / SAT later

1. Add a new registered book file
2. Choose the right `level`, `colorTheme`, and units
3. Add word lists with `learningConcept`, `tags`, and `examples`
4. Reuse the same generator and learning/review engines

Because the book system is registry-based, new exam books are mostly a **content task**, not a gameplay-engine task.

## Manual testing checklist

1. Run `npm run dev`
2. Open `/`
3. Check:
   - book cards render
   - recommended content is marked
   - favorites / difficult words / stats panels render
4. Open `/books`
5. Open a book and verify unit states are `Completed`, `Recommended`, or `Available`
6. Open a unit and verify:
   - estimated minutes
   - vocabulary overview
   - level cards render with `Jump ahead` when appropriate
7. Open a level and verify:
   - crossword gameplay still works
   - word cards show English meanings first
   - tapping one meaning switches only that word to Chinese
   - hints progress from pronunciation to letter positions without spending coins
   - an unavailable pronunciation does not reduce the score unless a phonetic fallback is shown
   - jump-ahead warning appears on advanced levels
8. Complete a level and verify:
   - coins update
   - recommended next level moves forward
   - study stats update
9. Open `/review` after a miss or clue:
   - the unresolved answer is absent from visible text and accessible labels
   - a wrong spelling stays available to edit
   - a correct spelling reveals the answer and clears current review debt
10. Refresh the page and verify progress, clue stage, and review debt restore from local storage
11. Open `/settings` and verify reset requires the explicit `ERASE` confirmation

## Automated verification

```bash
npm run test
npm run typecheck
npm run build
```
