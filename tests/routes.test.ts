import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { resolve } from "node:path";

describe("phase one support routes", () => {
  test("provides dedicated review and settings routes", () => {
    assert.equal(existsSync(resolve("app/review/page.tsx")), true);
    assert.equal(existsSync(resolve("app/settings/page.tsx")), true);
  });

  test("keeps level routes static while carrying a controlled return destination in the client", () => {
    const levelPage = readFileSync("app/levels/[levelId]/page.tsx", "utf8");
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const completion = readFileSync("components/CompletionActions.tsx", "utf8");
    assert.doesNotMatch(levelPage, /searchParams/);
    assert.match(game, /window\.location\.search/);
    assert.match(game, /sanitizeLevelReturnTo/);
    assert.match(game, /href=\{returnTo\}/);
    assert.match(completion, /replace/);
    assert.match(completion, /buildLevelHref\(nextLevelId, returnTo\)/);
  });

  test("automatically validates full words and keeps solved details out of answer mode", () => {
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const wheel = readFileSync("components/LetterWheel.tsx", "utf8");
    const slots = readFileSync("components/WordSlots.tsx", "utf8");
    assert.match(game, /draftView\.complete/);
    assert.match(game, /window\.setTimeout\(validateCompletedDraft, 0\)/);
    assert.match(game, /setInvalidDraftWordId\(activeClue\.id\)/);
    assert.doesNotMatch(wheel, /onSubmit|game\.submitWord|type=["']submit["']/);
    assert.match(slots, /onContinueFromDetail/);
    assert.match(slots, /progress\.completed \? level\.targetWords\[0\]/);
    assert.doesNotMatch(slots, /disabled=\{solved\}/);
    assert.match(game, /inspectedWordId !== undefined/);
    assert.match(game, /requiresTutorialDetail/);
    assert.match(wheel, /aria-invalid/);
    assert.match(wheel, /detailInputDisabled/);
    assert.doesNotMatch(game, /submitCurrentWord/);
    assert.equal(existsSync(resolve("components/CurrentWord.tsx")), false);
  });

  test("persists a resumable tutorial and provides a non-mutating settings reference", () => {
    const home = readFileSync("app/page.tsx", "utf8");
    const map = readFileSync("app/map/page.tsx", "utf8");
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const settings = readFileSync("app/settings/page.tsx", "utf8");
    assert.equal(existsSync(resolve("app/tutorial/page.tsx")), true);
    assert.match(home, /tutorial\.resumeFirstLevel/);
    assert.match(map, /advanceTutorial\("game-ui"\)/);
    assert.match(game, /advanceTutorial\("first-word-detail"/);
    assert.match(game, /advanceTutorial\("level-complete"/);
    assert.match(game, /advanceTutorial\("completed"/);
    assert.match(settings, /href="\/tutorial"/);
  });

  test("exposes all three courses and the offline assessment journey on Web", () => {
    const home = readFileSync("app/page.tsx", "utf8");
    const catalog = readFileSync("components/CourseCatalog.tsx", "utf8");
    const assessment = readFileSync("lib/web-assessment.ts", "utf8");
    const assessmentStorage = readFileSync("lib/web-assessment-storage.ts", "utf8");
    for (const route of [
      "assessment",
      "assessment/test",
      "assessment/result",
      "courses/[curriculumId]"
    ]) {
      assert.equal(existsSync(resolve(`app/${route}/page.tsx`)), true, route);
    }
    assert.match(home, /href="\/assessment"/);
    assert.match(home, /CourseCatalog/);
    assert.match(catalog, /ielts-nawl-v1/);
    assert.match(catalog, /kaoyan-core-v1/);
    assert.match(assessment, /bank-v1\.json/);
    assert.match(assessmentStorage, /word-trail-web-assessment-v1/);
    const assessmentScreen = readFileSync("components/WebAssessmentTest.tsx", "utf8");
    const assessmentResult = readFileSync("components/WebAssessmentResult.tsx", "utf8");
    assert.match(assessmentScreen, /toLocaleLowerCase/);
    assert.doesNotMatch(assessmentScreen, /t\("correct"\)/);
    assert.doesNotMatch(assessmentScreen, /correctAnswer/);
    assert.doesNotMatch(assessmentScreen, /bg-emerald-600/);
    assert.doesNotMatch(assessmentScreen, /bg-red-600/);
    assert.match(assessmentResult, /t\("rangeHeadline"/);
  });

  test("provides the complete friend-demo navigation journey", () => {
    for (const route of ["onboarding", "map", "parent"]) {
      assert.equal(existsSync(resolve(`app/${route}/page.tsx`)), true, route);
    }

    const layout = readFileSync("app/layout.tsx", "utf8");
    const gate = readFileSync("components/AppHydrationGate.tsx", "utf8");
    const completionActions = readFileSync("components/CompletionActions.tsx", "utf8");
    assert.match(layout, /AppHydrationGate/);
    assert.match(gate, /getRequiredOnboardingRoute/);
    assert.match(gate, /router\.replace\(requiredRoute\)/);
    assert.match(completionActions, /href="\/map"/);
    assert.doesNotMatch(completionActions, /href="\/books"[^>]*>[\s\S]*completion\.map/);
  });

  test("keeps home compact and map answer-free", () => {
    const home = readFileSync("app/page.tsx", "utf8");
    const map = readFileSync("app/map/page.tsx", "utf8");
    assert.doesNotMatch(home, /LevelCard|UnitCard|getUnitsByBookId/);
    assert.match(home, /getDueReviewSnapshot/);
    assert.match(home, /loadReviewMetadataIndex/);
    assert.match(home, /curriculum-progress-index/);
    assert.match(map, /curriculum-index/);
    assert.doesNotMatch(map, /content-runtime|vocabulary-loader|targetWords|\.word\b/);
    assert.doesNotMatch(
      map,
      /releaseLabel|level\.releaseStatus|map\.(?:demoReviewed|automatedBeta|licensed|legend)/
    );
    assert.match(map, /grid-cols-5/);
  });

  test("review consumes only the due queue and reports runtime failures", () => {
    const review = readFileSync("app/review/page.tsx", "utf8");
    const reviewQueue = readFileSync("lib/review-queue.ts", "utf8");
    assert.match(review, /getDueReviewSnapshot\(savedWords, activeProfile, reviewMetadata, reviewNow\)/);
    assert.match(review, /loadReviewMetadataIndex/);
    assert.match(review, /loadReviewWordsUntilLimit/);
    assert.match(review, /recoverableReviewCount/);
    assert.match(reviewQueue, /recoverable/);
    assert.match(reviewQueue, /"7-9": 5/);
    assert.match(reviewQueue, /"10-12": 8/);
    assert.match(reviewQueue, /"13-15": 12/);
    assert.doesNotMatch(review, /getReviewableDifficultWords/);
    assert.match(review, /runtimeStatus === "loading"/);
    assert.match(review, /runtimeStatus === "error"/);
    assert.match(review, /rt\("loadErrorDescription"\)/);
    assert.match(review, /rt\("partialWarning"/);
    assert.match(review, /visibilitychange/);
    assert.match(review, /window\.addEventListener\("focus"/);
  });

  test("parent view exposes recorded metrics without invented claims", () => {
    const parent = readFileSync("app/parent/page.tsx", "utf8");
    const metrics = readFileSync("lib/parent-metrics.ts", "utf8");
    assert.match(parent, /getParentLearningMetrics/);
    assert.match(metrics, /firstTryCorrectWords/);
    assert.match(metrics, /completedDueReviews/);
    assert.match(metrics, /actualHintEvents/);
    assert.match(metrics, /recordedWrongAttempts/);
    assert.match(parent, /ParentContentAccessControl/);
    assert.doesNotMatch(parent, /parent\.unofficial/);
    assert.doesNotMatch(parent, /totalStudyMinutes|ability|rank|firstAttempt/i);
    assert.doesNotMatch(metrics, /totalStudyMinutes|prediction|rank/i);
  });

  test("parent content confirmation is cancel-first and keyboard dismissible", () => {
    const control = readFileSync("components/ParentContentAccessControl.tsx", "utf8");
    assert.match(control, /cancelRef\.current\?\.focus\(\)/);
    assert.match(control, /event\.key === "Escape"/);
    assert.doesNotMatch(control, /privateTrialLimit/);
    assert.ok(
      control.indexOf("ref={cancelRef}") < control.indexOf("onClick={confirm}"),
      "Cancel must precede the confirm action"
    );
  });

  test("enforces one parent content policy before navigation or runtime loading", () => {
    const home = readFileSync("app/page.tsx", "utf8");
    const map = readFileSync("app/map/page.tsx", "utf8");
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const review = readFileSync("app/review/page.tsx", "utf8");
    const books = readFileSync("components/BookSelectionPage.tsx", "utf8");
    const units = readFileSync("components/BookUnitsPage.tsx", "utf8");
    const levels = readFileSync("components/UnitLevelsPage.tsx", "utf8");
    const levelCard = readFileSync("components/LevelCard.tsx", "utf8");
    assert.match(home, /getRecommendedEligibleLevel/);
    assert.match(map, /canAccessLevel/);
    assert.match(map, /aria-disabled="true"/);
    assert.match(game, /if \(!hasHydrated \|\| indexBlocked\) return/);
    assert.match(game, /canAccessLevel\(activeProfile, \{/);
    assert.match(game, /game\.contentBlockedTitle/);
    assert.match(review, /partitionReviewWordsByAccess/);
    assert.match(review, /rt\("restrictedSkipped"/);
    assert.match(books, /canAccessBook/);
    assert.match(units, /canAccessBook/);
    assert.match(levels, /canAccessLevel/);
    assert.match(levels, /isLevelAheadOfEligibleRecommendation/);
    assert.match(levelCard, /locked \? \(/);
  });

  test("keeps completion actions truthful and reset off the home page", () => {
    const completionActions = readFileSync("components/CompletionActions.tsx", "utf8");
    const homePage = readFileSync("app/page.tsx", "utf8");

    assert.doesNotMatch(completionActions, /href="\/review"/);
    assert.match(completionActions, /href="\/map"/);
    assert.match(completionActions, /nextLevelId/);
    assert.match(homePage, /href="\/settings"/);
    assert.doesNotMatch(homePage, /ResetProgressControl|resetProgress/);
  });

  test("orders the mobile game clue before the board and keeps desktop columns", () => {
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const slots = readFileSync("components/WordSlots.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");

    assert.match(game, /order-2[^"]*lg:order-1/);
    assert.match(game, /order-1[^"]*lg:order-2/);
    assert.match(game, /lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(320px,0\.85fr\)\]/);
    assert.match(slots, /overflow-x-auto/);
    const wheel = readFileSync("components/LetterWheel.tsx", "utf8");
    assert.match(wheel, /lg:h-\[360px\] lg:w-\[360px\]/);
    assert.match(wheel, /Math\.cos\(angle\) \* 41/);
    assert.doesNotMatch(wheel, /const radius = letters\.length/);
    assert.doesNotMatch(game, /game-corner/);
    assert.doesNotMatch(css, /\.game-corner/);
    assert.doesNotMatch(game, /game-table-surface/);
    assert.doesNotMatch(css, /\.game-table-surface/);
  });

  test("keeps game feedback in the clue panel flow instead of covering the board", () => {
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");
    const feedbackRegion = game.indexOf('data-testid="game-feedback-region"');
    const completionActions = game.indexOf("<CompletionActions", feedbackRegion);
    const asideEnd = game.indexOf("</aside>", feedbackRegion);

    assert.ok(feedbackRegion > 0, "Feedback needs a stable in-flow region");
    assert.ok(completionActions > feedbackRegion, "Feedback should precede completion actions");
    assert.ok(asideEnd > completionActions, "Feedback and completion actions must stay in the clue panel");
    assert.doesNotMatch(game, /game-feedback-float/);
    assert.doesNotMatch(css, /\.game-feedback-float/);
  });

  test("provides visible loading status and keyboard-operable map tabs", () => {
    const gate = readFileSync("components/AppHydrationGate.tsx", "utf8");
    const game = readFileSync("components/LevelGame.tsx", "utf8");
    const map = readFileSync("app/map/page.tsx", "utf8");

    assert.match(gate, /aria-live="polite"/);
    assert.match(gate, /t\("app\.loading"\)/);
    assert.match(game, /aria-live="polite"/);
    assert.match(game, /t\("game\.loading"\)/);
    assert.match(map, /role="tab"/);
    assert.match(map, /tabIndex=\{selected \? 0 : -1\}/);
    assert.match(map, /ArrowRight/);
    assert.match(map, /ArrowLeft/);
    assert.match(map, /aria-labelledby/);
  });

  test("keeps generated English labels, raw ids and estimates out of localized course cards", () => {
    const files = [
      "components/BookCard.tsx",
      "components/BookUnitsPage.tsx",
      "components/UnitCard.tsx",
      "components/UnitLevelsPage.tsx",
      "components/LevelCard.tsx"
    ].map((path) => readFileSync(path, "utf8")).join("\n");

    assert.doesNotMatch(files, /\{book\.title\}|\{book\.subtitle\}|\{book\.description\}/);
    assert.doesNotMatch(files, /\{unit\.title\}|estimatedMinutes/);
    assert.doesNotMatch(files, /\{level\.difficulty\}|id: level\.id/);
    assert.match(files, /book\.displayTitle/);
    assert.match(files, /unit\.displayTitle/);
    assert.match(files, /level\.displayTitle/);
    assert.equal(
      ["components/BookUnitsPage.tsx", "components/UnitLevelsPage.tsx"].every(
        (path) => readFileSync(path, "utf8").includes("LanguageSwitcher")
      ),
      true
    );
  });

  test("sanitizes the active clue and keeps answer records out of home", () => {
    const homePage = readFileSync("app/page.tsx", "utf8");
    const wordSlots = readFileSync("components/WordSlots.tsx", "utf8");
    const meaningToggle = readFileSync("components/WordMeaningToggle.tsx", "utf8");

    assert.match(homePage, /curriculum-progress-index/);
    assert.doesNotMatch(homePage, /getWordById|vocabulary-loader|\.displayText/);
    assert.match(wordSlots, /sanitizeLevelPresentationText/);
    assert.match(wordSlots, /safeText\(cluePresentation\.text\)/);
    assert.match(meaningToggle, /sanitizeText/);
  });

  test("labels settings as a parent control and shows review progress", () => {
    const settingsPage = readFileSync("app/settings/page.tsx", "utf8");
    const resetControl = readFileSync("components/ResetProgressControl.tsx", "utf8");
    const reviewPage = readFileSync("app/review/page.tsx", "utf8");

    assert.match(settingsPage, /settings\.parentControls|ResetProgressControl/);
    assert.match(resetControl, /settings\.parentControls/);
    assert.match(resetControl, /settings\.erase/);
    assert.match(resetControl, /settings\.keep/);
    assert.match(reviewPage, /rt\("remaining"\)/);
    assert.match(reviewPage, /rt\("spelling"\)/);
  });

  test("requires a named, focus-safe confirmation before deleting a profile", () => {
    const settingsPage = readFileSync("app/settings/page.tsx", "utf8");
    const deleteControl = readFileSync("components/DeleteProfileControl.tsx", "utf8");

    assert.match(settingsPage, /DeleteProfileControl/);
    assert.doesNotMatch(settingsPage, /onClick=\{\(\) => deleteProfile\(profile\.id\)\}/);
    assert.match(deleteControl, /settings\.deleteProfileTitle/);
    assert.match(deleteControl, /settings\.deleteProfileDescription/);
    assert.match(deleteControl, /profileName/);
    assert.match(deleteControl, /cancelRef\.current\?\.focus\(\)/);
    assert.match(deleteControl, /triggerRef\.current\?\.focus\(\)/);
    assert.match(deleteControl, /min-h-11/);
  });

  test("shows and enforces global read-only recovery state", () => {
    const gate = readFileSync("components/AppHydrationGate.tsx", "utf8");
    const settings = readFileSync("app/settings/page.tsx", "utf8");
    const store = readFileSync("store/gameStore.ts", "utf8");

    assert.match(gate, /hydrationStatus === "unsupported-version"/);
    assert.match(settings, /settings\.readOnlyNotice/);
    assert.match(settings, /selectIsReadOnly/);
    assert.match(store, /function mutationsAreBlocked/);
    assert.match(store, /if \(mutationsAreBlocked\(get\(\)\)\) return/);
  });

  test("review is an answer-safe input session instead of an answer card list", () => {
    const reviewPage = readFileSync("app/review/page.tsx", "utf8");

    assert.match(reviewPage, /type="text"/);
    assert.match(reviewPage, /submitReviewWord/);
    assert.match(reviewPage, /answeredWord/);
    assert.doesNotMatch(reviewPage, /<h2[^>]*>\{word\.displayText\}<\/h2>/);
  });

  test("keeps level route payload answer-free and protects reset confirmation focus", () => {
    const levelPage = readFileSync("app/levels/[levelId]/page.tsx", "utf8");
    const levelGame = readFileSync("components/LevelGame.tsx", "utf8");
    const resetControl = readFileSync("components/ResetProgressControl.tsx", "utf8");

    assert.match(levelPage, /key=\{levelId\}/);
    assert.match(levelPage, /satisfies LevelRoutePayload/);
    assert.match(levelPage, /contentVersion: curriculumContentVersion/);
    assert.doesNotMatch(levelPage, /level=\{level\}/);
    assert.doesNotMatch(levelPage, /getLevelById/);
    assert.match(levelGame, /loadLevelRuntimeBundle\(levelId, contentVersion/);
    assert.match(levelGame, /const runtimeLevelId = toRuntimeLevelId\(levelId\)/);
    assert.match(levelGame, /controller\.abort\(\)/);
    assert.match(levelGame, /setLoadError\(true\)/);
    assert.match(levelGame, /if \(!level \|\| level\.id !== runtimeLevelId\)/);
    assert.doesNotMatch(levelGame, /level\.id !== levelId/);
    assert.match(levelGame, /key=\{`\$\{contentVersion\}:\$\{runtimeLevelId\}`\}/);
    assert.match(resetControl, /aria-live/);
    assert.match(resetControl, /\.focus\(\)/);
  });

  test("keeps unit pages on the answer-free curriculum index", () => {
    const unitPage = readFileSync("components/UnitLevelsPage.tsx", "utf8");

    assert.match(unitPage, /curriculum-index/);
    assert.doesNotMatch(unitPage, /getUnitWords|vocabulary-loader|wordIds/);
    assert.doesNotMatch(unitPage, />\{word\.displayText\}<\/p>/);
    assert.doesNotMatch(unitPage, /wordLabel=\{word\.displayText\}/);
  });

  test("settles level and review speech only through guarded callbacks", () => {
    const levelGame = readFileSync("components/LevelGame.tsx", "utf8");
    const reviewPage = readFileSync("app/review/page.tsx", "utf8");

    assert.match(levelGame, /const playPronunciation = \(\) =>/);
    assert.match(levelGame, /const revealLetterHint = \(\) =>/);
    assert.doesNotMatch(levelGame, /confirmPronunciationHint/);
    assert.match(levelGame, /isSpeechRequestCurrent/);
    assert.match(reviewPage, /onStarted/);
    assert.match(reviewPage, /onFailed/);
    assert.match(reviewPage, /isSpeechRequestCurrent/);
    assert.doesNotMatch(reviewPage, /speakEnglishWord\([^)]*\)\) \{/);
  });

  test("lets one answer-safe clue control the real across-and-down board", () => {
    const levelGame = readFileSync("components/LevelGame.tsx", "utf8");
    const crosswordGrid = readFileSync("components/CrosswordGrid.tsx", "utf8");
    const wordSlots = readFileSync("components/WordSlots.tsx", "utf8");

    assert.match(levelGame, /selectedWordId/);
    assert.match(levelGame, /resolveActiveClue/);
    assert.match(levelGame, /useHint\(level, progress, activeClue\.id\)/);
    assert.match(wordSlots, /onSelectWord/);
    assert.match(wordSlots, /getActiveCluePresentation/);
    assert.match(wordSlots, /clueLanguage/);
    assert.match(crosswordGrid, /activeWordId/);
    assert.match(crosswordGrid, /gridColumnStart/);
    assert.match(crosswordGrid, /gridRowStart/);
    assert.doesNotMatch(crosswordGrid, /Array\.from\(\{ length: level\.grid\.rows \}\)/);
  });
});
