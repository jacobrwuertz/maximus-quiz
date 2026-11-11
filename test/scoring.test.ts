// Scored results: points per answer, a total, result bands, and the
// question-count progress mode.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizEngine } from '../src/engine.js';
import { lint } from '../src/linter.js';
import { parseQuiz } from '../src/parser.js';
import { parseBand, parseScore, scoreRange } from '../src/scoring.js';
import { generateWebflowQuiz, verifyQuizMarkup } from '../src/authoring/index.js';
import type { QuizDefinition } from '../src/authoring/index.js';

/** Two scored radio steps (0-3 each, max 6) then a result step with three bands. */
const SCORED = `
  <div data-quiz="sym" data-quiz-advance>
    <div data-quiz-progress data-quiz-progress-count="questions">
      <div data-quiz-progress-bar></div>
      <div data-quiz-progress-label data-quiz-progress-format="Question {n} of {total}"></div>
    </div>
    <section data-quiz-step="energy">
      <div data-quiz-question="energy" data-quiz-type="radio">
        <div data-quiz-answer="strong" data-quiz-score="0">Strong</div>
        <div data-quiz-answer="ok" data-quiz-score="1">OK</div>
        <div data-quiz-answer="low" data-quiz-score="2">Low</div>
        <div data-quiz-answer="drained" data-quiz-score="3">Drained</div>
      </div>
    </section>
    <section data-quiz-step="drive">
      <div data-quiz-question="drive" data-quiz-type="radio">
        <div data-quiz-answer="same" data-quiz-score="0">Same</div>
        <div data-quiz-answer="lower" data-quiz-score="1">Lower</div>
        <div data-quiz-answer="much" data-quiz-score="2">Much</div>
        <div data-quiz-answer="gone" data-quiz-score="3">Gone</div>
      </div>
    </section>
    <section data-quiz-step="result">
      <div data-quiz-band="0-1" id="mild">Mild</div>
      <div data-quiz-band="2-4" id="moderate">Moderate</div>
      <div data-quiz-band="5+" id="strong">Strong</div>
      <span data-quiz-score-total id="total"></span>
    </section>
  </div>`;

function build(html: string): QuizEngine {
  document.body.innerHTML = html;
  const engine = new QuizEngine(parseQuiz(document.querySelector('[data-quiz]')!), {
    autoAdvanceDelay: 10,
  });
  engine.start();
  return engine;
}

function pick(question: string, value: string): void {
  document
    .querySelector<HTMLElement>(`[data-quiz-question="${question}"] [data-quiz-answer="${value}"]`)!
    .click();
  vi.advanceTimersByTime(20);
}

function shownBand(): string | null {
  const shown = [...document.querySelectorAll<HTMLElement>('[data-quiz-band]')].filter(
    (b) => !b.hidden,
  );
  expect(shown.length).toBeLessThanOrEqual(1);
  return shown[0]?.id ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseBand / parseScore', () => {
  it('parses closed, open and single ranges', () => {
    expect(parseBand('0-3')).toEqual({ min: 0, max: 3 });
    expect(parseBand(' 4 - 9 ')).toEqual({ min: 4, max: 9 });
    expect(parseBand('10+')).toEqual({ min: 10, max: Number.POSITIVE_INFINITY });
    expect(parseBand('5')).toEqual({ min: 5, max: 5 });
    expect(parseBand('-2-3')).toEqual({ min: -2, max: 3 });
  });

  it('rejects malformed and inverted ranges', () => {
    expect(parseBand('')).toBeNull();
    expect(parseBand('mild')).toBeNull();
    expect(parseBand('9-4')).toBeNull();
  });

  it('parses only numeric scores', () => {
    expect(parseScore('2')).toBe(2);
    expect(parseScore('-1')).toBe(-1);
    expect(parseScore(null)).toBeNull();
    expect(parseScore('')).toBeNull();
    expect(parseScore('two')).toBeNull();
  });
});

describe('score total and bands', () => {
  // One persona per band plus both sides of every boundary.
  const cases: Array<[string, string, number, string]> = [
    ['strong', 'same', 0, 'mild'],
    ['ok', 'same', 1, 'mild'],
    ['ok', 'lower', 2, 'moderate'],
    ['drained', 'lower', 4, 'moderate'],
    ['drained', 'much', 5, 'strong'],
    ['drained', 'gone', 6, 'strong'],
  ];

  for (const [energy, drive, total, band] of cases) {
    it(`${energy} + ${drive} = ${total} shows ${band}`, () => {
      const engine = build(SCORED);
      pick('energy', energy);
      pick('drive', drive);
      expect(engine.getScore()).toBe(total);
      expect(document.querySelector('[data-quiz]')!.getAttribute('data-quiz-score')).toBe(
        String(total),
      );
      expect(document.getElementById('total')!.textContent).toBe(String(total));
      expect(shownBand()).toBe(band);
      expect(
        [...document.querySelectorAll<HTMLElement>('[data-quiz-step]')].find((s) => !s.hidden)!
          .getAttribute('data-quiz-step'),
      ).toBe('result');
    });
  }

  it('re-scores when an answer changes', () => {
    const engine = build(SCORED);
    pick('energy', 'drained');
    expect(engine.getScore()).toBe(3);
    engine.goTo('energy');
    pick('energy', 'strong');
    expect(engine.getScore()).toBe(0);
  });

  it('ignores points on a step hidden by show-if', () => {
    const html = SCORED.replace(
      '<section data-quiz-step="drive">',
      '<section data-quiz-step="drive" data-quiz-show-if="energy!=strong">',
    );
    const engine = build(html);
    pick('energy', 'ok');
    pick('drive', 'gone');
    expect(engine.getScore()).toBe(4);
    engine.goTo('energy');
    pick('energy', 'strong');
    // drive is now hidden; its stored 3 points no longer count.
    expect(engine.getScore()).toBe(0);
  });

  it('adds every selected checkbox answer', () => {
    document.body.innerHTML = `
      <div data-quiz="cb">
        <section data-quiz-step="s">
          <div data-quiz-question="sym" data-quiz-type="checkbox">
            <div data-quiz-answer="a" data-quiz-score="1">A</div>
            <div data-quiz-answer="b" data-quiz-score="2">B</div>
          </div>
        </section>
      </div>`;
    const engine = new QuizEngine(parseQuiz(document.querySelector('[data-quiz]')!));
    engine.start();
    document.querySelector<HTMLElement>('[data-quiz-answer="a"]')!.click();
    document.querySelector<HTMLElement>('[data-quiz-answer="b"]')!.click();
    expect(engine.getScore()).toBe(3);
  });

  it('includes the score on events of a scored quiz', () => {
    const engine = build(SCORED);
    const seen: Array<number | undefined> = [];
    engine.on('answer', (e) => seen.push(e.score));
    pick('energy', 'low');
    expect(seen).toEqual([2]);
  });

  it('leaves unscored quizzes untouched', () => {
    document.body.innerHTML = `
      <div data-quiz="plain">
        <section data-quiz-step="s">
          <div data-quiz-question="q" data-quiz-type="radio">
            <div data-quiz-answer="a">A</div><div data-quiz-answer="b">B</div>
          </div>
        </section>
      </div>`;
    const engine = new QuizEngine(parseQuiz(document.querySelector('[data-quiz]')!));
    const seen: Array<number | undefined> = [];
    engine.on('answer', (e) => seen.push(e.score));
    engine.start();
    document.querySelector<HTMLElement>('[data-quiz-answer="a"]')!.click();
    expect(engine.getScore()).toBe(0);
    expect(seen).toEqual([undefined]);
    expect(document.querySelector('[data-quiz]')!.hasAttribute('data-quiz-score')).toBe(false);
  });
});

describe('progress counted by questions', () => {
  function progress(): { label: string; hidden: boolean; width: string } {
    const label = document.querySelector<HTMLElement>('[data-quiz-progress-label]')!;
    const bar = document.querySelector<HTMLElement>('[data-quiz-progress-bar]')!;
    return { label: label.textContent ?? '', hidden: label.hidden, width: bar.style.width };
  }

  it('counts answer steps only and fills on the result', () => {
    build(SCORED);
    expect(progress()).toEqual({ label: 'Question 1 of 2', hidden: false, width: '0%' });
    pick('energy', 'ok');
    expect(progress()).toEqual({ label: 'Question 2 of 2', hidden: false, width: '50%' });
    pick('drive', 'same');
    expect(progress()).toMatchObject({ hidden: true, width: '100%' });
  });

  it('keeps the default step count when the mode is not set', () => {
    build(SCORED.replace(' data-quiz-progress-count="questions"', ''));
    expect(progress()).toMatchObject({ label: 'Question 1 of 3', width: '33%' });
  });
});

describe('scoring lint rules', () => {
  function rules(html: string): string[] {
    document.body.innerHTML = html;
    return lint(parseQuiz(document.querySelector('[data-quiz]')!)).findings.map((f) => f.rule);
  }

  it('is clean on a well-formed scored quiz', () => {
    const report = (() => {
      document.body.innerHTML = SCORED;
      return lint(parseQuiz(document.querySelector('[data-quiz]')!));
    })();
    expect(report.findings.filter((f) => f.rule.startsWith('score') || f.rule.startsWith('band'))).toEqual([]);
  });

  it('flags a non-numeric score', () => {
    expect(rules(SCORED.replace('data-quiz-score="2"', 'data-quiz-score="two"'))).toContain(
      'score-invalid',
    );
  });

  it('flags a malformed band', () => {
    expect(rules(SCORED.replace('data-quiz-band="2-4"', 'data-quiz-band="moderate"'))).toContain(
      'band-invalid',
    );
  });

  it('flags bands with no scored answers', () => {
    expect(rules(SCORED.replace(/ data-quiz-score="\d"/g, ''))).toContain('band-without-scores');
  });

  it('flags a gap and an overlap between bands', () => {
    const gap = rules(SCORED.replace('data-quiz-band="2-4"', 'data-quiz-band="2-3"'));
    expect(gap).toContain('band-coverage');
    const overlap = rules(SCORED.replace('data-quiz-band="2-4"', 'data-quiz-band="1-4"'));
    expect(overlap).toContain('band-coverage');
  });

  it('computes the widest possible range', () => {
    document.body.innerHTML = SCORED;
    expect(scoreRange(parseQuiz(document.querySelector('[data-quiz]')!))).toEqual({ min: 0, max: 6 });
  });
});

describe('generator and verify carry scores and bands', () => {
  const def: QuizDefinition = {
    id: 'gen-scored',
    advance: true,
    progressCount: 'questions',
    progressFormat: 'Question {n} of {total}',
    steps: [
      {
        slug: 'energy',
        questions: [
          {
            key: 'energy',
            type: 'radio',
            label: 'Energy?',
            answers: [
              { value: 'strong', label: 'Strong', score: 0 },
              { value: 'drained', label: 'Drained', score: 3 },
            ],
          },
        ],
      },
      {
        slug: 'result',
        bands: [
          { range: '0-1', label: 'Mild', heading: 'Mild heading' },
          { range: '2+', label: 'Strong', heading: 'Strong heading' },
        ],
        cta: { label: 'Check my levels', href: 'https://app.example.com/labs' },
      },
    ],
  };

  it('emits score, band, progress and cta attributes', () => {
    const { html, warnings } = generateWebflowQuiz(def);
    expect(warnings).toEqual([]);
    expect(html).toContain('data-quiz-score="3"');
    expect(html).toContain('data-quiz-band="2+"');
    expect(html).toContain('data-quiz-progress-count="questions"');
    expect(html).toContain('data-quiz-progress-format="Question {n} of {total}"');
    expect(html).toContain('href="https://app.example.com/labs" data-quiz-cta');
  });

  it('verify passes on the generated markup', () => {
    const { html, classes } = generateWebflowQuiz(def);
    document.body.innerHTML = html;
    const report = verifyQuizMarkup(document.querySelector('[data-quiz]'), def, classes);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('verify reports a dropped score and a dropped band', () => {
    const { html } = generateWebflowQuiz(def);
    document.body.innerHTML = html
      .replace(' data-quiz-score="3"', '')
      .replace(' data-quiz-band="2+"', '');
    const kinds = verifyQuizMarkup(document.querySelector('[data-quiz]'), def).problems.map(
      (p) => p.kind,
    );
    expect(kinds).toContain('wrong-score');
    expect(kinds).toContain('missing-band');
  });

  it('warns on a malformed band range in the definition', () => {
    const bad: QuizDefinition = {
      ...def,
      steps: [def.steps[0]!, { slug: 'result', bands: [{ range: 'mild' }] }],
    };
    expect(generateWebflowQuiz(bad).warnings.join(' ')).toContain('Band range "mild"');
  });
});
