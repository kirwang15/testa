# Word Trail

Word Trail is a private, local-first English crossword adventure. The APK
defaults to the all-ages 3+ content profile. A learner selects one clue, fills
boxed letters, and completes connected across/down words that share crossing
cells.

The APK contains 600 offline levels: four New Concept English study scopes with
100 levels per book, plus 200 IELTS preparation vocabulary levels built from
600 NAWL 1.2 headwords. It is an **unofficial personal learning tool**, not a
Pearson or official IELTS product. Review status remains internal and must not
be presented to learners as product feedback.

## Product experience

- First-run choice between Chinese guidance and English immersion.
- UI language and clue language are independent; clues default to English.
- Only one clue language is rendered at a time.
- Every formal board is connected, contains both directions, and has no isolated word.
- Unsolved answers stay out of HTML/RSC, visible DOM, ARIA names, titles, and data attributes.
- Completion offers next level, map, and a fresh Replay; first-pass rewards cannot be claimed twice.
- Review shows only currently due local items.
- Parent view reports recorded events only: completed levels, first-try correct answers, due reviews, hints, errors, mastered words, active days, and streak.
- Profiles, progress, settings, and content access choices remain in the browser.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production-style friend demo:

```bash
npm run build
npm run start
```

## Verification commands

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
git diff --check
npm audit
```

### Android release APK

Build and verify the private Android release artifact with:

```bash
npm run build:android-apk
```

The command produces one APK containing `armeabi-v7a` and `arm64-v8a`, rejects
`x86_64` or any unexpected ABI, and fails unless the artifact is smaller than
50,000,000 bytes. It generates content first and also rejects an APK whose
embedded catalog is not exactly 2 curricula, 8 tracks, 400 NCE levels, and 200
IELTS levels. To verify an existing build without rebuilding it, run:

```bash
npm run check:android-apk
```

The release build intentionally keeps the current private debug signing. Replace
it with a protected production keystore before any public distribution.

`npm run test:e2e` expects an existing production build and uses `npm run start`. Install the Playwright Chromium binary once if the local machine does not already have it. Browser CLI execution should be explicitly approved in controlled environments.

## Architecture

```text
app/                         Next.js routes
components/                  UI, crossword, onboarding, and controls
lib/                         App-facing content, profile, i18n, and storage boundaries
src/content/vocabulary/      Offline curriculum sources and editorial overlays
src/lib/                     Pure game, learning, review, and generation engines
store/                       Zustand profile-aware persistence
public/content/runtime/      Generated per-level/per-word browser bundles (ignored)
e2e/                         Playwright friend-demo journeys
tests/                       Node unit, migration, content, and boundary tests
types/                       Shared public contracts
```

### Content delivery boundary

The server-rendered level route receives only `levelId + contentVersion`. The browser then loads one static runtime bundle for that level. Home, map, books, settings, and parent views use an answer-free curriculum index and do not import the full course or answers.

`npm run generate:content-runtime` creates:

- 400 formal NCE level bundles and 200 formal IELTS preparation bundles for Flutter;
- one answer-free Flutter curriculum catalog with eight tracks;
- 25 hidden Legacy Practice bundles;
- answer-free curriculum and review indexes;
- content-addressed manifest metadata.

Runtime generation is deterministic and never fetches remote content.

### Formal content gates

- Four NCE books × 100 levels. Core levels 1–50 are compatibility-locked;
  reinforcement levels 51–100 cover the same 200 words in new groups.
- NCE core and reinforcement each use 3 words in their first 15 levels, 4 in
  the next 20, and 5 in the final 15.
- Four IELTS preparation stages × 50 levels, with 3 unique NAWL words per level.
- IELTS groups are solved globally from formally valid triples, then ordered so
  average NAWL frequency rank increases across the four stages.
- 800 unique NCE spellings and 600 unique IELTS-course spellings. Identical
  spellings across curricula retain separate word ids and progress.
- Complete Book/Lesson/edition/provenance metadata.
- `rows <= 11` and `cols <= 11`.
- Exactly one connected component, at least one across and one down word, and at least one crossing per word.
- Continuous letter runs must exactly match configured targets.
- Missing source, placeholder copy, duplicate spelling, unsafe clue, disconnected layout, or incomplete runtime bundle blocks generation.
- Formal IELTS spellings are alphabetic and 3–10 letters; all-ages word and
  source-definition filters plus their exclusions/replacements are recorded in
  the authoring manifest.

See [Content authoring](docs/content-authoring.md) before changing course data.

## Learning and review

Mastery is an integer from 0–5. Correct unassisted outcomes can increase mastery at most once per local calendar day; errors lower mastery and schedule review. Default intervals are 1, 3, 7, 14, and 30 days.

Review caps are age-aware after content-access filtering:

- 7–9: 5 due items;
- 10–12: 8 due items;
- 13–15: 12 due items.

Wrong and clue reasons remain until the learner correctly spells the item in `/review`. The app does not invent study minutes, ability predictions, ranking, or remote analytics.

## Local save format

The persisted store is version 3:

```ts
type ProfiledGameProgress = {
  storageVersion: 3;
  contentVersion: string;
  profiles: Record<string, PlayerProfile>;
  activeProfileId: string;
  progressByProfileId: Record<string, GameProgress>;
};
```

Version 1 and 2 saves migrate idempotently. Malformed data recovers into a safe local profile. A future or conflicting version enters read-only recovery and is never overwritten. Storage parse and quota errors are caught and surfaced without a white screen. See [Save migration v3](docs/save-migration-v3.md).

## Language and accessibility

- Core routes use one typed i18n dictionary.
- Switching UI language updates `<html lang>` and the page title.
- Switching clue language replaces the rendered clue; the inactive language is absent from DOM and accessibility attributes.
- Buttons and links in the friend-demo path are at least 44×44px.
- The map uses keyboard-operable roving tabs.
- Dialogs are cancel-first and focus-safe.

## Friend demo status

Automated and browser QA cover onboarding, compact home, first level, clue switching, completion, Replay reward protection, map, due-review empty state, parent metrics, and settings. The comparison against the supplied handwritten reference is documented in [design-qa.md](design-qa.md).

Before inviting friends, use [Friend demo checklist](docs/friend-demo-checklist.md). Before public or commercial release, obtain appropriate content rights and complete human semantic/age review. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
