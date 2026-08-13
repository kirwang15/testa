# Content authoring and review

## Release statuses

- `automated-beta`: source mapping and automated gates passed; human meaning and age review are incomplete.
- `demo-reviewed`: a named human reviewed every field used in the private demo.
- `licensed-production`: content rights and production editorial review are documented.

Do not promote a word or level because tests pass. Automated validation proves structure, not the intended textbook sense, child suitability, or permission to redistribute.

## Required word fields

Every formal word requires spelling, an original English clue, Chinese meaning,
part of speech, phonetic form, an original example, CEFR, rating, source type,
and a provenance id. NCE words additionally require Book, Lesson, edition
`1997`, and double-source verification. NAWL words require list id `NAWL-1.2`
and an official frequency rank. Kaoyan starter words require source type
`kaoyan`, an NGSL/NAWL list id and rank, plus the audited wordfreq version and
Zipf frequency used for auxiliary ordering.

Rules:

1. Use a licensed/user-owned source or a reference-only local snapshot with clearly recorded legal status.
2. Map NCE words to Book/Lesson using two independent references. Select NAWL
   words from the checked-in CC BY-SA 4.0 snapshot in frequency order.
3. Write clues and examples locally; do not copy textbook sentences or a third-party dictionary wholesale.
4. Keep the spelling alphabetic and 3–10 letters long for the formal crossword
   course. Two-letter entries are recorded as structurally ineligible because
   they cannot satisfy the required per-word crossing gate.
5. A clue must explain the intended sense without containing the answer or a trivial morphological leak.
6. Assign `all-ages`, `13-plus`, or `parent-review` based on meaning and context, not spelling alone.
7. Keep automated work as `automated`; only a human reviewer may set `human-reviewed`.

## Course topology

- NCE uses four tracks with 100 levels each. Levels 1–50 are the immutable core
  compatibility set; levels 51–100 regroup the same 200 spellings once for
  reinforcement using the same `15×3 + 20×4 + 15×5` progression.
- IELTS preparation uses four stages with 50 levels each. Every level contains
  three words, and the complete course contains 600 unique NAWL spellings. The
  generator solves one global 600-word exact cover over formally valid triples,
  sorts solved groups by mean then maximum NAWL rank, and requires stage-average
  rank to increase from stage 1 through stage 4.
- Kaoyan Core Vocabulary · Starter uses four stages with 50 levels each and
  three words per level. It independently selects 300 NGSL and 300 NAWL words,
  then uses the checked-in wordfreq 3.1.1 snapshot for auxiliary ordering. Each
  stage contains exactly 150 words and the course is explicitly not a complete
  or official postgraduate entrance-exam syllabus.
- Spellings must be unique inside one curriculum. The same spelling may exist
  in separate curricula only when each course has a distinct word id.
- User-visible copy must not expose `automated-beta` or other internal review
  and validation terminology.

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

The IELTS authoring source is generated offline from caller-provided official
NAWL snapshots. It never fetches content at build or application runtime:

```bash
node scripts/author-ielts-nawl.cjs \
  --dictionary /path/to/NAWL_gloss.html \
  --alphabetized /path/to/NAWL_1.2_alphabetized_description.txt
```

The authoring manifest records the official snapshot hashes, model digest,
two-layer all-ages word/definition filters, every exclusion and replacement,
and the hash of any explicit editorial override. Overrides pass the same clue,
example, Chinese, and leakage validator as model-authored entries.

The Kaoyan source is also generated offline. `npm run author:kaoyan-core`
verifies the NGSL and wordfreq snapshot hashes, the 300/300 source split, all
600 unique spellings, complete authored fields, and four 150-word stages. To
refresh only the wordfreq-derived snapshot, use wordfreq 3.1.1 in an isolated
Python environment and run `scripts/snapshot-kaoyan-wordfreq.py`; commit the
new hash and attribution together with any intentional snapshot change.

`npm run generate:content-runtime` then writes both the browser runtime and the
Flutter `catalog.json` plus all 800 offline level bundles. Generation fails on
count drift, source drift, a changed NCE core level, duplicate coverage,
disconnected/oversized layouts, missing crossings, or incomplete metadata.
The catalog `contentVersion` hashes resolved NCE words (including source and
rating), content ratings, the NCE compatibility snapshot, the complete IELTS
and Kaoyan authoring documents, and the generator implementation. A separate
compatibility hash freezes the complete semantics and catalog projection of
all 600 previously shipped NCE/IELTS bundles while allowing only the outer
catalog `contentVersion` to change.

Legacy ids and URLs are canonicalized under `legacy:` and are excluded from the formal daily course.
