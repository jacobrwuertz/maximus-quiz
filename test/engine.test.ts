import { beforeEach, describe, expect, it } from 'vitest';
import { QuizEngine } from '../src/engine.js';
import { parseQuiz } from '../src/parser.js';

function build(html: string): QuizEngine {
  document.body.innerHTML = html;
  const engine = new QuizEngine(parseQuiz(document.querySelector('[data-quiz]')!));
  engine.start();
  return engine;
}

const FLOW = `
  <div data-quiz="finder">
    <section data-quiz-step="intro" data-quiz-type="content">
      <button data-quiz-next>next</button>
    </section>
    <section data-quiz-step="goal">
      <div data-quiz-question="goal" data-quiz-type="radio">
        <div data-quiz-answer="ts">TS</div>
        <div data-quiz-answer="fert">Fert</div>
      </div>
      <button data-quiz-back>back</button>
      <button data-quiz-next>next</button>
    </section>
    <section data-quiz-step="fert-note" data-quiz-type="content" data-quiz-show-if="goal=fert">
      <button data-quiz-next>next</button>
    </section>
    <section data-quiz-step="result" data-quiz-type="content">
      <p data-quiz-show-if="goal=ts" id="ts-msg">TS msg</p>
    </section>
  </div>`;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('navigation', () => {
  it('shows only the first step initially', () => {
    build(FLOW);
    const steps = document.querySelectorAll<HTMLElement>('[data-quiz-step]');
    expect(steps[0]!.hidden).toBe(false);
    expect([...steps].slice(1).every((s) => s.hidden)).toBe(true);
  });

  it('advances and goes back', () => {
    const e = build(FLOW);
    e.next();
    expect(document.querySelector<HTMLElement>('[data-quiz-step="goal"]')!.hidden).toBe(false);
    e.back();
    expect(document.querySelector<HTMLElement>('[data-quiz-step="intro"]')!.hidden).toBe(false);
  });

  it('back is disabled on the first step', () => {
    build(FLOW);
    expect(document.querySelector('[data-quiz-back]')!.hasAttribute('disabled')).toBe(true);
  });
});

describe('answer capture', () => {
  it('records a radio selection and marks it selected', () => {
    const e = build(FLOW);
    e.next();
    const ts = document.querySelector<HTMLElement>('[data-quiz-answer="ts"]')!;
    ts.click();
    expect(e.getAnswers().goal).toBe('ts');
    expect(ts.getAttribute('data-quiz-selected')).toBe('true');
  });

  it('radio is single-select (selecting one clears the sibling)', () => {
    const e = build(FLOW);
    e.next();
    document.querySelector<HTMLElement>('[data-quiz-answer="ts"]')!.click();
    document.querySelector<HTMLElement>('[data-quiz-answer="fert"]')!.click();
    expect(document.querySelector('[data-quiz-answer="ts"]')!.getAttribute('data-quiz-selected')).toBe(
      'false',
    );
    expect(e.getAnswers().goal).toBe('fert');
  });

  it('restores selection from persisted answers', () => {
    localStorage.setItem('maximus.quiz.finder', JSON.stringify({ goal: 'ts' }));
    build(FLOW);
    expect(
      document.querySelector('[data-quiz-answer="ts"]')!.getAttribute('data-quiz-selected'),
    ).toBe('true');
  });
});

describe('checkbox', () => {
  const CB = `
    <div data-quiz="q"><section data-quiz-step="s">
      <div data-quiz-question="concerns" data-quiz-type="checkbox">
        <div data-quiz-answer="energy">E</div>
        <div data-quiz-answer="libido">L</div>
      </div>
    </section></div>`;

  it('multi-selects and toggles off', () => {
    const e = build(CB);
    document.querySelector<HTMLElement>('[data-quiz-answer="energy"]')!.click();
    document.querySelector<HTMLElement>('[data-quiz-answer="libido"]')!.click();
    expect(e.getAnswers().concerns).toEqual(['energy', 'libido']);
    document.querySelector<HTMLElement>('[data-quiz-answer="energy"]')!.click();
    expect(e.getAnswers().concerns).toEqual(['libido']);
  });
});

describe('Other option', () => {
  const OTHER = `
    <div data-quiz="q"><section data-quiz-step="s">
      <div data-quiz-question="format" data-quiz-type="radio">
        <div data-quiz-answer="oral">Oral</div>
        <div data-quiz-answer="other" data-quiz-other>Other
          <input data-quiz-input type="text" hidden />
        </div>
      </div>
    </section></div>`;

  it('reveals the input when Other is selected and stores typed value', () => {
    const e = build(OTHER);
    const other = document.querySelector<HTMLElement>('[data-quiz-answer="other"]')!;
    const input = document.querySelector<HTMLInputElement>('[data-quiz-input]')!;
    other.click();
    expect(input.hidden).toBe(false);
    input.value = 'sublingual';
    input.dispatchEvent(new Event('input'));
    expect(e.getAnswers().format).toBe('other');
    expect(e.getAnswers().format_other).toBe('sublingual');
  });

  it('hides the input and clears value when another option is chosen', () => {
    const e = build(OTHER);
    document.querySelector<HTMLElement>('[data-quiz-answer="other"]')!.click();
    const input = document.querySelector<HTMLInputElement>('[data-quiz-input]')!;
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    document.querySelector<HTMLElement>('[data-quiz-answer="oral"]')!.click();
    expect(input.hidden).toBe(true);
    expect(e.getAnswers().format_other).toBeUndefined();
  });
});

describe('conditional visibility', () => {
  it('hides a step whose condition is unmet and shows it when met', () => {
    const e = build(FLOW);
    // Skip to goal, choose fert → fert-note step becomes part of the flow.
    e.next();
    document.querySelector<HTMLElement>('[data-quiz-answer="fert"]')!.click();
    const slugs = e.visibleSteps().map((s) => s.slug);
    expect(slugs).toContain('fert-note');
    // Choosing ts removes it.
    document.querySelector<HTMLElement>('[data-quiz-answer="ts"]')!.click();
    expect(e.visibleSteps().map((s) => s.slug)).not.toContain('fert-note');
  });

  it('toggles an inline conditional element', () => {
    const e = build(FLOW);
    e.next();
    document.querySelector<HTMLElement>('[data-quiz-answer="ts"]')!.click();
    expect(document.querySelector<HTMLElement>('#ts-msg')!.hidden).toBe(false);
  });
});

describe('events', () => {
  it('emits complete on submit', () => {
    const e = build(FLOW);
    let fired = false;
    e.on('complete', () => (fired = true));
    e.submit();
    expect(fired).toBe(true);
  });
});
