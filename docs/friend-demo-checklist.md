# Private friend demo checklist

## Before the session

```bash
npm install
npm test
npm run typecheck
npm run build
npm audit
npm run start
```

Use `http://localhost:3000` on the same machine, or the printed local-network address only on a trusted private network. Do not describe the course as official, licensed, or fully human-reviewed.

## Five-minute child path

1. Hand over the device without explaining the UI.
2. Observe whether the learner chooses a mode and enters the first level within 60 seconds.
3. Ask them to read the English clue; only mention the clue-language button if they cannot find help.
4. Observe whether they understand that crossing cells are shared.
5. Let them use pronunciation or letter/position hints.
6. After completion, ask which next action they expect: next level, map, or replay.

Do not record names, audio, video, or remote analytics without explicit parent permission. Notes should describe interface behavior, not identify the child.

## Parent path

Show `/parent` and explain that it reports device-recorded counters only. Confirm the parent understands:

- there is no account or cloud sync;
- clearing browser storage can remove progress;
- content references are unofficial;
- age/content settings are guidance, not identity verification;
- no actual study-time or ability estimate is shown.

## Success signals

- 4 of 5 testers enter the first level without verbal instruction.
- First level completes within five minutes.
- At least 80% understand that the clue button switches one language at a time.
- No answer leakage, dead route, white screen, profile crossover, or repeated reward occurs.
- The child can complete the main loop at 390×844 without hunting above and below the fold.

If the learner is confused, change onboarding or clue copy before adding features. If content is questioned, keep that level Beta and expand human review before exposing more levels.
