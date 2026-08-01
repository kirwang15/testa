# Local save migration v3

The store key is `word-trail-mvp-progress`. Version 3 separates profiles and binds progress to the generated content version.

## Supported inputs

- v1 flat progress: migrated into one local profile and Legacy-compatible ids.
- v2 profile envelope: normalized per profile; existing users are not forced back through onboarding.
- v3: validated and normalized without changing the profile key identity.
- malformed JSON or malformed legacy object: recovered into a safe profile with a visible recovery state.

Migration is idempotent. Profile map keys are authoritative if an embedded profile id conflicts, preventing two learners from being merged.

## Fail-closed behavior

If the outer version, inner version, or flat save reports a future version, or if envelope versions conflict:

1. Preserve the original raw save.
2. Enter `unsupported-version` read-only recovery.
3. Block mutations and replacement writes.
4. Let the learner inspect the app without silently downgrading data.

Read/parse/quota/private-mode failures are caught. A failed write sets a visible non-blocking state so the user is not told progress was safely saved when it was not.

## Content revisions

Formal content uses `nce-1997-*` ids and a deterministic `contentVersion`. A layout revision change clears coordinate-based hint state while retaining completion history, coins, stars, mastery, and word outcomes. Recognized old and Legacy references are upgraded; unknown references are quarantined rather than relabeled.

## Manual recovery check

Before a release that changes persistence:

1. Back up a real browser save.
2. Open the new build and confirm the active profile and progress.
3. Confirm profile switching does not share coins, levels, preferences, or word progress.
4. Simulate malformed JSON, a quota write error, and a future version.
5. Refresh after each case and verify the original future-version payload was not overwritten.

Automated coverage lives in `tests/profile-state.test.ts` and `tests/game-store-safety.test.ts`.
