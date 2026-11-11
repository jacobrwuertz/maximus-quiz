# @maximus/quiz

A standalone, attribute-driven marketing quiz engine. Zero runtime dependencies,
no AI, no network calls. You write the markup; the engine scans it for
`data-quiz-*` attributes and wires the behavior. Because it operates on
author-supplied markup, the **same build drops into the Next.js site, an Unbounce
landing page, or Sanity-rendered HTML unchanged**.

It does four things:

1. Runs the quiz (Text Cards, Radio, Checkbox, Text questions, plus an "Other" box).
2. Aggregates answers into browser storage as the primary personalization source.
3. Carries an allow-listed subset of answers to other Maximus subdomains.
4. **Lints its own configuration** and surfaces console warnings — so a broken
   personalization (a card pointed at an answer that doesn't exist) is caught at
   page load, not in production analytics.

## Install / embed

**Bundler (Next.js, etc.):**

```ts
import { init } from '@maximus/quiz';
import '@maximus/quiz/theme.css'; // optional brand theme

init({ root: '#quiz', handoff: { carryKeys: ['goal'] } });
```

**Drop-in `<script>` (Unbounce, Sanity, any CMS):**

```html
<link rel="stylesheet" href="maximus-quiz.css" />
<main data-quiz="testosterone-finder" data-quiz-auto>…</main>
<script src="maximus-quiz.iife.js"></script>
```

Adding `data-quiz-auto` to the root auto-initializes on load. Add `data-quiz-dev`
to also show the lint overlay. For explicit control, call `MaximusQuiz.init({…})`.

## Attribute reference

The guiding rule: **stable machine keys are the data contract; display copy lives
in the element's inner HTML.** Editing question wording never changes a stored
key, so aggregation and personalization stay intact.

| Attribute | Role | Value |
|---|---|---|
| `data-quiz` | Quiz root | quiz id, e.g. `testosterone-finder` |
| `data-quiz-auto` | Auto-init on load (script-tag path) | (empty) |
| `data-quiz-step` | One screen, shown one at a time | step slug |
| `data-quiz-question` | A question | **stable key**, e.g. `goal` |
| `data-quiz-type` | Question type | `radio` \| `checkbox` \| `text` \| `content` |
| `data-quiz-answer` | An answer option | **stable value**, e.g. `testosterone-support` |
| `data-quiz-other` | Marks the "Other" option | (empty) — reveals its bound input |
| `data-quiz-input` | Text input (text question, or inside an Other option) | (empty) |
| `data-quiz-next` / `data-quiz-back` / `data-quiz-submit` | Navigation | (empty) |
| `data-quiz-show-if` | Conditional display (personalization) | expression — see below |
| `data-quiz-advance` | Auto-advance on answer click — see below | (empty) on the root or a step; `"false"` opts a step out |
| `data-quiz-progress` | Progress host (with optional `[data-quiz-progress-bar]`) | (empty) |
| `data-quiz-cta` | Outbound CTA link to decorate with carry params | (link) |

A **Text Card** is a step (or question) with `data-quiz-type="content"` — content
only, no answer collected, advanced with `data-quiz-next`. Use them for intros,
interstitials, and personalized follow-ups (gate with `data-quiz-show-if`).

### Auto-advance (`data-quiz-advance`)

Clicking an answer moves to the next step on its own, with no Next button —
the Formly/Typeform behaviour. Put `data-quiz-advance` on the root to enable it
for the whole quiz, or on a single step to scope it. `data-quiz-advance="false"`
on a step opts that step out. In code: `init({ autoAdvance: true })`.

Four rules, all deliberate:

- **Radio only.** A checkbox question has no natural "done" moment and a text
  question would advance mid-typing, so a step containing either one always
  waits for an explicit control. `content` questions are ignored.
- **The whole step must be answered.** A step with two radio questions advances
  when both hold an answer, not on the first click.
- **It never submits.** On the last step the engine stops and waits for a real
  `data-quiz-submit`, so auto-advance can't fire completion before someone has
  seen a contact field or a summary.
- **There is a short pause** (350ms, `autoAdvanceDelay`) so the selection
  registers. Changing the answer during it restarts the timer rather than
  double-advancing. The root carries `data-quiz-advancing="true"` for the
  duration, which is a styling hook — don't use it to block clicks, since the
  pause exists so people can change their mind.

### Scored results (`data-quiz-score`, `data-quiz-band`)

Give answers points and show a result by total:

```html
<div data-quiz-answer="drained" data-quiz-score="3">Drained most of the time</div>
...
<div data-quiz-band="0-3">Mild result</div>
<div data-quiz-band="4-9">Moderate result</div>
<div data-quiz-band="10+">Strong result</div>
<span data-quiz-score-total></span>
```

- The total is the sum of the selected answers' points on visible steps. A step
  or question hidden by show-if adds nothing. Checkbox questions add every
  selected answer.
- A `data-quiz-band` element is shown only while the total is inside its
  inclusive range: `"4-9"`, `"10+"` (open-ended) or a single number. A band that
  also has `data-quiz-show-if` must pass both.
- The root carries `data-quiz-score="<total>"`, `[data-quiz-score-total]`
  elements show the number, events include `score`, and the instance exposes
  `getScore()`.
- The linter reports a non-numeric score (`score-invalid`), a malformed range
  (`band-invalid`), bands with no scored answers (`band-without-scores`), and
  any reachable total that no band, or more than one band, covers
  (`band-coverage`).
- Definitions take `score` on answers and `bands`, `html` and `cta` on a step.
  `quiz:verify` fails if a published page dropped a score or a band.

### Progress by question (`data-quiz-progress-count`)

Set `data-quiz-progress-count="questions"` on the progress host to count only
steps that collect an answer, so a result screen does not inflate the total. The
bar shows completed questions (empty on the first), reads 100% on the result,
and the label hides there. `data-quiz-progress-format="Question {n} of {total}"`
on the label sets its text. Definitions: `progressCount` and `progressFormat`.

### Inline on a landing page

`scripts/build-embed.mjs` packs the theme CSS, the engine and an explicit init
into one HtmlEmbed for a quiz that lives inside a landing page instead of its
own page. Generate the block with `"auto": false` so the site-wide loader's copy
of the engine does not also wire it. The script also writes a fixture so the E2E
runs the exact shipped code. Example: `webflow/lab-test-symptom-check.*`.

### `data-quiz-show-if` expressions

```
goal=testosterone-support          equals (radio/text) / contains (checkbox)
goal!=fertility-preservation       not equals / not contains
concerns~=energy                   checkbox set contains value
goal in fertility-preservation,both   value is one of the list
```

## Answer aggregation & cross-domain handoff

Answers persist to `localStorage` under `maximus.quiz.<id>` — single values for
radio/text, arrays for checkbox, and `<key>_other` for an Other option's text.
This is the personalization source of truth on the marketing site.

To carry answers to `app.maximustribe.com`, configure `handoff`:

```ts
init({
  handoff: {
    carryKeys: ['goal'],          // ONLY these keys leave the origin
    cookieDomain: '.maximustribe.com',
    cookieName: 'mx_quiz',
    ctaSelector: '[data-quiz-cta]',
    paramPrefix: 'qz_',
  },
});
```

When configured, the engine writes a cookie scoped to the parent domain (auto-
carries to subdomains) **and** appends `?qz_goal=…` params to CTA links at click
time (params survive the app handoff seam). The app reads either to personalize.

> **Sensitive data — read this.** This is a health-adjacent quiz. **Nothing leaves
> the origin unless its key is named in `carryKeys`** (the default is an empty
> list — carry nothing). Keep the full answer set in `localStorage`; opt only
> non-sensitive routing keys (e.g. chosen product/protocol) into `carryKeys`.
> Set `cookieDomain` to the shared parent domain only when the page is actually
> served from it.

## Building for Webflow

Webflow's MCP bridge can set attributes, but only one element at a time. A
twelve-question quiz needs sixty-plus of those calls, every one has to land, and
the call fails outright with a **"component map" conflict** on anything inside a
component. That is where `data-quiz-*` attributes go missing in an AI-driven
build, and why a quiz can publish looking fine while skipping a question.

Attributes inserted as *part of an HTML block* don't have that problem. A single
`data_whtml_builder` insert preserves them — proven on the Maximus LP site by the
native `<details>` FAQ pattern, whose `name="<page>-faq"` attribute was verified
in published HTML.

So the rule is: **generate the whole quiz, insert it in one call, then verify
what published.** Never re-apply quiz attributes element by element.

```bash
# 1. Generate one HTML block from a definition file.
npm run quiz:generate -- --def examples/testosterone-finder.json --out build/

# 2. Create every class it lists as a Webflow style — see the warning below.
#    Then insert build/<id>.html with data_whtml_builder, in ONE call.

# 3. Verify what actually shipped. Exits 1 on any drop, so it works as a gate.
npm run quiz:verify -- --def build/<id>.built.json --url https://page.maximustribe.com/quiz
```

> **Create the styles first.** Webflow **silently drops class names** in inserted
> HTML when no matching style exists — the element survives, the class doesn't,
> and the quiz renders unstyled with no error. `quiz:generate` prints the full
> class list for exactly this reason, and records it in `<id>.built.json` so
> `quiz:verify` can catch any that went missing.

`quiz:verify` reports four kinds of silent failure: a missing step, question or
answer attribute; a `data-quiz-type` that got dropped (which quietly changes how
answers are captured); a class Webflow discarded; and a quiz id that no longer
matches, which splits stored answers across two namespaces. It also runs the
linter below over the published markup.

Both tools are also importable: `import { generateWebflowQuiz, verifyQuizMarkup }
from '@maximus/quiz/authoring'`. They are build-time only — the runtime entry
never imports them, so none of it ships to a landing page.

## Self-diagnosis (the linter)

The linter treats the markup as infrastructure. It runs on init (logs grouped
console output) and on demand via the returned instance's `.lint()`, which
returns a structured `LintReport` (`{ ok, errors, warnings, infos, findings }`).
Use `MaximusQuiz.lintOnly('#quiz')` to lint without starting the engine.

| Rule | Severity | Catches |
|---|---|---|
| `show-if-unknown-key` | error | personalization pointing at a question that doesn't exist |
| `show-if-unknown-value` | error | personalization pointing at an answer that doesn't exist |
| `duplicate-question-key` | error | two questions sharing a key (answers collide) |
| `duplicate-answer-value` | error | a question offering the same value twice |
| `empty-question` | error | radio/checkbox with no answers; text with no input |
| `orphan-answer` | error/warn | an answer/input outside any question |
| `other-missing-input` | error | an Other option with no text input to capture |
| `no-steps` | error | a quiz with no steps |
| `empty-key` | error | a missing question key or answer value |
| `condition-ordering` | warn | a condition depending on a later-step answer |
| `missing-type` | info | a question with no explicit `data-quiz-type` |
| `kebab-case` | info | keys/values that aren't kebab-case |
| `single-answer` | info | a radio question with only one option |

## Events

```ts
const quiz = init({ root: '#quiz' });
quiz.on('answer', (e) => console.log(e.detail, e.answers));
quiz.on('complete', (e) => track('start-assessment', e.answers));
```

Each also fires a DOM `CustomEvent` (`quiz:answer`, `quiz:step`, `quiz:complete`)
on the root, for non-JS consumers (e.g. a GTM trigger on the qualified-start CTA).

## Development

```bash
pnpm install          # respects the HQ supply-chain release-age policy
pnpm check            # typecheck + lint + unit tests
pnpm build            # emits dist/ (ESM + IIFE + .d.ts + theme css)
pnpm test:e2e         # Playwright against the static fixtures
```

Fixtures live in `fixtures/` — `testosterone.html` is the flagship 3-question
demo; `broken.html` is deliberately misconfigured to prove the linter fires.

> Fixture copy is placeholder only. Real testosterone marketing copy is
> compliance-gated (FDA age-indication, ISI, ROSCA) — do not ship fixture text.
