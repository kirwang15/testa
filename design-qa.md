# Word Trail reference comparison and browser QA

Date: 2026-07-18
Scope: private friend-demo journey, mobile `390×844`, desktop `1440×900`

## Visual sources

- User reference: `/var/folders/f1/gdvg7ln97x95pyrtk5p4zf0h0000gn/T/codex-clipboard-fcdb4f95-7790-4167-aab7-4305f05c6014.png`
- Corrected reference: `artifacts/design-qa/reference-rotated.png`
- Same-image comparison: `artifacts/design-qa/reference-vs-prototype.jpg`
- Mobile onboarding: `artifacts/design-qa/onboarding-mobile.png`
- Mobile home: `artifacts/design-qa/home-mobile.png`
- Mobile level: `artifacts/design-qa/level-001-mobile-compact.png`
- Mobile map: `artifacts/design-qa/map-mobile.png`
- Desktop level: `artifacts/design-qa/level-001-desktop-english-clue.png`

The comparison image places the corrected handwritten reference on the left and the running production build on the right. Both visibly use horizontal and vertical words connected by shared letters. The product replaces unbounded handwriting with explicit empty boxes and highlights the active word.

## Measured browser results

| Surface | Result |
| --- | --- |
| Onboarding mobile height | `1127px`; no horizontal overflow |
| Home mobile height | `1176px`, below the `1688px` two-screen limit |
| Level mobile height | `1050px`; no horizontal overflow |
| Mobile main loop | clue top `76px`, grid top `383px`, submit bottom `830px` |
| Desktop level | `1440×900` document fits one viewport |
| Touch targets | no visible button/link/input smaller than `44×44px` |
| Routes | `/`, `/map`, `/review`, `/parent`, `/settings`, first level all rendered |
| Map keyboard | ArrowRight moved selection from Book 1 to Book 2 |

## Interaction evidence

- Fresh profile completed onboarding and entered level 1.
- English clue was the default on a fresh profile.
- Switching to Chinese removed the English clue from body text and every DOM attribute checked.
- UI switch updated `<html lang="en">` and title to `Word Trail · Crossword Adventure`.
- The first connected board was solved as three crossing words; shared cells were prefilled in later words.
- First completion changed coins from `100` to `125` and exposed next level, map, and Replay.
- Replay reset the board to `0/3`; completing it again left coins at `125`.
- Parent metrics then showed 1 completed adventure, 3 first-ever correct answers, 0 hints, 0 errors, and 1 active day.
- Review correctly showed an empty due state on the same date.
- Parent rating confirmation was cancel-first and cancel preserved `all-ages`.

## Findings and fixes

- Fixed: the submit control originally landed below the 844px fold. Board width, mobile spacing, clue copy spacing, and wheel diameter were reduced without shrinking controls below 44px. In the final production build it ends at `830px`.
- Fixed: the last decorative `game-table-surface` div/CSS art was removed.
- Fixed: the earlier QA document referenced the wrong image and made unsupported pass claims; this file replaces it with the supplied reference and measured evidence.

## Verdict

- P0 answer, route, profile, and reward failures found in this pass: none.
- P1 mobile main-loop and navigation failures found after fixes: none.
- P2 visual comparison issues blocking a private friend demo: none.
- Private friend-demo UI result: **passed**.
- Public/licensed course result: **not approved**. The 800-word course remains `automated-beta`; Book 1 demo words still require named human semantic/age review and content-rights confirmation before any public or commercial release.
