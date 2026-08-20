// Generator + verify gate.
//
// The important tests here are the round-trips: markup the generator emits must
// drive a working engine, and the verify gate must FAIL when an attribute or a
// class goes missing — the two silent Webflow failures it exists to catch.

import { beforeEach, describe, expect, it } from 'vitest';
import { QuizEngine } from '../src/engine.js';
import { parseQuiz } from '../src/parser.js';
import {
  generateWebflowQuiz,
  validateDefinition,
  type QuizDefinition,
} from '../src/authoring/webflow.js';
import { formatVerifyReport, verifyQuizMarkup } from '../src/authoring/verify.js';

const DEF: QuizDefinition = {
  id: 'testosterone-finder',
  advance: true,
  steps: [
    {
      slug: 'goal',
      heading: 'What brings you here?',
      questions: [
        {
          key: 'goal',
          type: 'radio',
          label: 'Your main goal',
          answers: [
            { value: 'testosterone-support', label: 'Testosterone support' },
            { value: 'fertility-preservation', label: 'Fertility preservation' },
          ],
        },
      ],
    },
    {
      slug: 'concerns',
      heading: 'Anything else?',
      questions: [
        {
          key: 'concerns',
          type: 'checkbox',
          label: 'Pick any that apply',
          answers: [
            { value: 'energy', label: 'Low energy' },
            { value: 'sleep', label: 'Poor sleep' },
            { value: 'other', label: 'Something else', other: true },
          ],
        },
      ],
      next: 'Continue',
      back: 'Back',
    },
    {
      slug: 'fertility-note',
      showIf: 'goal=fertility-preservation',
      heading: 'A note on fertility',
      body: 'Some protocols suit this goal better than others.',
      next: 'Got it',
    },
    {
      slug: 'result',
      heading: 'Your match',
      submit: 'See my result',
    },
  ],
};

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.querySelector<HTMLElement>('[data-quiz]')!;
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('generateWebflowQuiz', () => {
  it('emits one block carrying every attribute the engine needs', () => {
    const { html } = generateWebflowQuiz(DEF);
    expect(html).toContain('data-quiz="testosterone-finder"');
    expect(html).toContain('data-quiz-auto');
    expect(html).toContain('data-quiz-advance');
    expect(html).toContain('data-quiz-step="goal"');
    expect(html).toContain('data-quiz-question="goal"');
    expect(html).toContain('data-quiz-type="radio"');
    expect(html).toContain('data-quiz-answer="testosterone-support"');
    expect(html).toContain('data-quiz-show-if="goal=fertility-preservation"');
    expect(html).toContain('data-quiz-submit');
  });

  it('returns every class it used, so styles can be created first', () => {
    const { classes } = generateWebflowQuiz(DEF);
    expect(classes).toContain('mx-quiz_wrap');
    expect(classes).toContain('mx-quiz_step');
    expect(classes).toContain('mx-quiz_answer');
    expect(classes).toContain('mx-quiz_other-input');
    // No duplicates — the caller creates each style once.
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('honours a custom class prefix', () => {
    const { classes, html } = generateWebflowQuiz({ ...DEF, classPrefix: 'quiz' });
    expect(classes).toContain('quiz_wrap');
    expect(html).toContain('class="quiz_step"');
  });

  it('escapes copy so an apostrophe or bracket cannot break the markup', () => {
    const { html } = generateWebflowQuiz({
      id: 'q',
      steps: [
        {
          slug: 's',
          heading: 'Fish & chips <script>alert(1)</script>',
          questions: [
            {
              key: 'k',
              type: 'radio',
              answers: [
                { value: 'a', label: '"Quoted" & <b>bold</b>' },
                { value: 'b', label: 'Plain' },
              ],
            },
          ],
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;');
    expect(html).toContain('&lt;script&gt;');
  });

  it('binds an Other option to its own input', () => {
    const { html } = generateWebflowQuiz(DEF);
    const root = mount(html);
    const other = root.querySelector('[data-quiz-other]')!;
    expect(other.querySelector('[data-quiz-input]')).not.toBeNull();
  });

  it('omits the progress block when asked', () => {
    const { html } = generateWebflowQuiz({ ...DEF, progress: false });
    expect(html).not.toContain('data-quiz-progress');
  });
});

describe('generated markup drives the engine', () => {
  it('parses into the model the definition described', () => {
    const { html } = generateWebflowQuiz(DEF);
    const model = parseQuiz(mount(html));

    expect(model.id).toBe('testosterone-finder');
    expect(model.advance).toBe(true);
    expect(model.steps.map((s) => s.slug)).toEqual([
      'goal',
      'concerns',
      'fertility-note',
      'result',
    ]);
    expect(model.questions.map((q) => q.key)).toEqual(['goal', 'concerns']);
    expect(model.questions[1]!.answers.find((a) => a.isOther)?.otherInput).not.toBeNull();
  });

  it('runs a full flow: answer, branch, submit', () => {
    const { html } = generateWebflowQuiz(DEF);
    const root = mount(html);
    const engine = new QuizEngine(parseQuiz(root), { autoAdvance: false });
    engine.start();

    root.querySelector<HTMLElement>('[data-quiz-answer="fertility-preservation"]')!.click();
    expect(engine.getAnswers()['goal']).toBe('fertility-preservation');

    engine.next();
    root.querySelector<HTMLElement>('[data-quiz-answer="energy"]')!.click();
    expect(engine.getAnswers()['concerns']).toEqual(['energy']);

    // The fertility branch is open, so it is the next visible step.
    engine.next();
    expect(engine.visibleSteps()[2]!.slug).toBe('fertility-note');

    let completed = false;
    engine.on('complete', () => (completed = true));
    engine.next();
    root.querySelector<HTMLElement>('[data-quiz-submit]')!.click();
    expect(completed).toBe(true);
  });

  it('hides the branch step when the answer closes it', () => {
    const { html } = generateWebflowQuiz(DEF);
    const root = mount(html);
    const engine = new QuizEngine(parseQuiz(root), { autoAdvance: false });
    engine.start();

    root.querySelector<HTMLElement>('[data-quiz-answer="testosterone-support"]')!.click();
    expect(engine.visibleSteps().map((s) => s.slug)).toEqual(['goal', 'concerns', 'result']);
  });

  it('generated markup lints clean', () => {
    const { html } = generateWebflowQuiz(DEF);
    const report = verifyQuizMarkup(mount(html), DEF);
    expect(report.lint!.errors).toBe(0);
  });
});

describe('validateDefinition', () => {
  it('accepts a sound definition', () => {
    expect(validateDefinition(DEF)).toEqual([]);
  });

  it('catches duplicate question keys', () => {
    const warnings = validateDefinition({
      id: 'q',
      steps: [
        { slug: 'a', questions: [{ key: 'dup', type: 'text' }] },
        { slug: 'b', questions: [{ key: 'dup', type: 'text' }] },
      ],
    });
    expect(warnings.join(' ')).toContain('Duplicate question key: "dup"');
  });

  it('catches duplicate answer values inside one question', () => {
    const warnings = validateDefinition({
      id: 'q',
      steps: [
        {
          slug: 'a',
          questions: [
            {
              key: 'k',
              type: 'radio',
              answers: [
                { value: 'same', label: 'One' },
                { value: 'same', label: 'Two' },
              ],
            },
          ],
        },
      ],
    });
    expect(warnings.join(' ')).toContain('Duplicate answer value "same"');
  });

  it('catches a show-if pointing at a key the quiz never collects', () => {
    const warnings = validateDefinition({
      id: 'q',
      steps: [
        { slug: 'a', questions: [{ key: 'goal', type: 'radio', answers: [
          { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] }] },
        { slug: 'b', showIf: 'typo=x' },
      ],
    });
    expect(warnings.join(' ')).toContain('unknown question key "typo"');
  });

  it('flags a radio question with only one answer', () => {
    const warnings = validateDefinition({
      id: 'q',
      steps: [
        { slug: 'a', questions: [{ key: 'k', type: 'radio', answers: [{ value: 'only', label: 'Only' }] }] },
      ],
    });
    expect(warnings.join(' ')).toContain('fewer than 2 answers');
  });

  it('flags a redundant Next control on an auto-advancing step', () => {
    const warnings = validateDefinition({
      id: 'q',
      advance: true,
      steps: [
        {
          slug: 'a',
          next: 'Next',
          questions: [
            { key: 'k', type: 'radio', answers: [
              { value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
          ],
        },
        { slug: 'b' },
      ],
    });
    expect(warnings.join(' ')).toContain('also declares a Next control');
  });
});

describe('verifyQuizMarkup catches what shipped wrong', () => {
  function published(): { root: HTMLElement; classes: string[] } {
    const { html, classes } = generateWebflowQuiz(DEF);
    return { root: mount(html), classes };
  }

  it('passes on a faithful publish', () => {
    const { root, classes } = published();
    const report = verifyQuizMarkup(root, DEF, classes);
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
    expect(report.counts).toEqual({ steps: 4, questions: 2, answers: 5 });
  });

  it('reports a missing root rather than throwing', () => {
    document.body.innerHTML = '<p>no quiz here</p>';
    const report = verifyQuizMarkup(null, DEF);
    expect(report.ok).toBe(false);
    expect(report.problems[0]!.kind).toBe('missing-root');
  });

  it('catches a dropped question attribute', () => {
    const { root, classes } = published();
    root.querySelector('[data-quiz-question="concerns"]')!.removeAttribute('data-quiz-question');
    const report = verifyQuizMarkup(root, DEF, classes);
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.kind === 'missing-question')).toBe(true);
  });

  it('catches a dropped answer attribute', () => {
    const { root, classes } = published();
    root.querySelector('[data-quiz-answer="energy"]')!.removeAttribute('data-quiz-answer');
    const report = verifyQuizMarkup(root, DEF, classes);
    expect(report.problems.some((p) => p.kind === 'missing-answer')).toBe(true);
  });

  it('catches a dropped step attribute', () => {
    const { root, classes } = published();
    root.querySelector('[data-quiz-step="result"]')!.removeAttribute('data-quiz-step');
    const report = verifyQuizMarkup(root, DEF, classes);
    expect(report.problems.some((p) => p.kind === 'missing-step')).toBe(true);
  });

  it('catches a dropped type attribute, which silently changes capture', () => {
    const { root, classes } = published();
    root.querySelector('[data-quiz-question="concerns"]')!.removeAttribute('data-quiz-type');
    const report = verifyQuizMarkup(root, DEF, classes);
    const problem = report.problems.find((p) => p.kind === 'wrong-type');
    expect(problem).toBeDefined();
    expect(problem!.detail).toContain('concerns');
  });

  it('catches a class Webflow dropped for having no style', () => {
    const { root, classes } = published();
    root.querySelectorAll('.mx-quiz_answer').forEach((el) => el.classList.remove('mx-quiz_answer'));
    const report = verifyQuizMarkup(root, DEF, classes);
    const problem = report.problems.find((p) => p.kind === 'missing-class');
    expect(problem).toBeDefined();
    expect(problem!.detail).toContain('mx-quiz_answer');
  });

  it('skips the class check when no class list is supplied', () => {
    const { root } = published();
    root.querySelectorAll('.mx-quiz_answer').forEach((el) => el.classList.remove('mx-quiz_answer'));
    const report = verifyQuizMarkup(root, DEF);
    expect(report.problems.some((p) => p.kind === 'missing-class')).toBe(false);
  });

  it('catches a quiz id that does not match, which splits stored answers', () => {
    const { root, classes } = published();
    root.setAttribute('data-quiz', 'renamed-by-hand');
    const report = verifyQuizMarkup(root, DEF, classes);
    expect(report.problems.some((p) => p.kind === 'wrong-id')).toBe(true);
  });

  it('fails when the linter finds an error even with nothing missing', () => {
    const { root, classes } = published();
    // Point a condition at a key the quiz does not collect.
    root
      .querySelector('[data-quiz-step="fertility-note"]')!
      .setAttribute('data-quiz-show-if', 'nonexistent=value');
    const report = verifyQuizMarkup(root, DEF, classes);
    expect(report.problems).toEqual([]);
    expect(report.lint!.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('formats a readable pass and a readable failure', () => {
    const { root, classes } = published();
    expect(formatVerifyReport(verifyQuizMarkup(root, DEF, classes))).toContain('RESULT: pass');

    root.querySelector('[data-quiz-answer="energy"]')!.removeAttribute('data-quiz-answer');
    const text = formatVerifyReport(verifyQuizMarkup(root, DEF, classes));
    expect(text).toContain('RESULT: FAIL');
    expect(text).toContain('missing-answer');
  });
});
