# Content authoring and review

## Release statuses

- `automated-beta`: source mapping and automated gates passed; human meaning and age review are incomplete.
- `demo-reviewed`: a named human reviewed every field used in the private demo.
- `licensed-production`: content rights and production editorial review are documented.

Do not promote a word or level because tests pass. Automated validation proves structure, not the intended textbook sense, child suitability, or permission to redistribute.

## Required word fields

Each formal word requires spelling, original English clue, Chinese meaning, part of speech, phonetic form, original example, CEFR, rating, Book, Lesson, edition `1997`, double-source verification, and a provenance id.

Rules:

1. Use a licensed/user-owned source or a reference-only local snapshot with clearly recorded legal status.
2. Map the word to Book/Lesson using two independent references.
3. Write clues and examples locally; do not copy textbook sentences or a third-party dictionary wholesale.
4. Keep the spelling alphabetic and no longer than 10 letters for the formal course.
5. A clue must explain the intended sense without containing the answer or a trivial morphological leak.
6. Assign `all-ages`, `13-plus`, or `parent-review` based on meaning and context, not spelling alone.
7. Keep automated work as `automated`; only a human reviewer may set `human-reviewed`.

## Human review sheet

For each demo word, confirm:

- spelling and intended sense;
- part of speech and phonetic form;
- English clue and Chinese meaning alignment;
- example grammar and age suitability;
- Book/Lesson mapping against the reviewer’s legitimate source;
- rating and any cultural/safety concern;
- no copied textbook sentence.

Record reviewer, date, content version, and decision outside the generated file. The current repository does not claim this review has happened.

## Build and validation

```bash
npm run generate:content-runtime
npm test
npm run typecheck
npm run build
```

Generation must fail rather than fall back to a disconnected layout, duplicate spelling, oversized board, missing source, placeholder clue, or incomplete coverage.

The optional local authoring tools can refine owned fields with Ollama, but their output remains Beta until human review:

```bash
node scripts/refine-nce-clues.cjs
node scripts/refine-nce-examples.cjs
```

Legacy ids and URLs are canonicalized under `legacy:` and are excluded from the formal daily course.
