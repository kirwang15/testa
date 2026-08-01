# Word Trail

Word Trail is a private, local-first English crossword adventure for learners aged 7–15. A learner selects one clue, fills boxed letters, and completes connected across/down words that share crossing cells.

The current build contains four New Concept English study scopes with 50 levels per book (200 levels, 800 unique spellings). It is an **unofficial personal learning tool**, not a Pearson product. The supplied course is an automated Beta index; it must not be described as licensed or fully human-reviewed.

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

- 200 formal level bundles;
- 25 hidden Legacy Practice bundles;
- answer-free curriculum and review indexes;
- content-addressed manifest metadata.

Runtime generation is deterministic and never fetches remote content.

### Formal content gates

- Four books × 50 levels.
- 800 globally unique spellings.
- 3 words in levels 1–15, 4 in levels 16–35, 5 in levels 36–50.
- Complete Book/Lesson/edition/provenance metadata.
- `rows <= 11` and `cols <= 11`.
- Exactly one connected component, at least one across and one down word, and at least one crossing per word.
- Continuous letter runs must exactly match configured targets.
- Missing source, placeholder copy, duplicate spelling, unsafe clue, disconnected layout, or incomplete runtime bundle blocks generation.

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
