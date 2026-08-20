// Auto-advance: selecting a radio answer moves to the next step on its own.
//
// The behaviour is timer-driven, so these tests drive vitest's fake clock
// rather than waiting in real time.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizEngine } from '../src/engine.js';
import { parseQuiz } from '../src/parser.js';
import type { QuizConfig } from '../src/types.js';

function build(html: string, config: QuizConfig = {}): QuizEngine {
  document.body.innerHTML = html;
  const engine = new QuizEngine(parseQuiz(document.querySelector('[data-quiz]')!), config);
  engine.start();
  return engine;
}

function click(selector: string): void {
  document.querySelector<HTMLElement>(selector)!.click();
}

function visibleStep(): string | null {
  const shown = [...document.querySelectorAll<HTMLElement>('[data-quiz-step]')].find(
    (s) => !s.hidden,
  );
  return shown?.getAttribute('data-quiz-step') ?? null;
}

/** Two radio steps then a final step, with auto-advance on at the root. */
const RADIO_FLOW = `
  <div data-quiz="finder" data-quiz-advance>
    <section data-quiz-step="goal">
      <div data-quiz-question="goal" data-quiz-type="radio">
        <div data-quiz-answer="ts" id="a-ts">TS</div>
        <div data-quiz-answer="fert" id="a-fert">Fert</div>
      </div>
    </section>
    <section data-quiz-step="age">
      <div data-quiz-question="age" data-quiz-type="radio">
        <div data-quiz-answer="30s" id="a-30s">30s</div>
      </div>
    </section>
    <section data-quiz-step="result" data-quiz-type="content">
      <button data-quiz-submit id="submit">Submit</button>
    </section>
  </div>`;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('auto-advance', () => {
  it('is off unless opted in', () => {
    build(RADIO_FLOW.replace(' data-quiz-advance', ''));
    click('#a-ts');
    vi.advanceTimersByTime(2000);
    expect(visibleStep()).toBe('goal');
  });

  it('advances after a radio answer when enabled on the root', () => {
    build(RADIO_FLOW);
    click('#a-ts');
    expect(visibleStep()).toBe('goal'); // not yet — the pause is deliberate
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('age');
  });

  it('can be enabled by config instead of markup', () => {
    build(RADIO_FLOW.replace(' data-quiz-advance', ''), { autoAdvance: true });
    click('#a-ts');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('age');
  });

  it('honours a custom delay', () => {
    build(RADIO_FLOW, { autoAdvanceDelay: 1000 });
    click('#a-ts');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('goal');
    vi.advanceTimersByTime(650);
    expect(visibleStep()).toBe('age');
  });

  it('a step can opt out of an enabled quiz', () => {
    build(RADIO_FLOW.replace('data-quiz-step="goal"', 'data-quiz-step="goal" data-quiz-advance="false"'));
    click('#a-ts');
    vi.advanceTimersByTime(2000);
    expect(visibleStep()).toBe('goal');
  });

  it('a step can opt in to a disabled quiz', () => {
    build(
      RADIO_FLOW.replace(' data-quiz-advance', '').replace(
        'data-quiz-step="goal"',
        'data-quiz-step="goal" data-quiz-advance',
      ),
    );
    click('#a-ts');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('age');
  });

  it('changing the answer during the pause restarts the timer, advancing once', () => {
    const e = build(RADIO_FLOW);
    const steps: string[] = [];
    e.on('step', (ev) => steps.push(ev.answers['goal'] as string));

    click('#a-ts');
    vi.advanceTimersByTime(200); // mid-pause
    click('#a-fert'); // changed their mind
    vi.advanceTimersByTime(200); // original timer would have fired here
    expect(visibleStep()).toBe('goal');

    vi.advanceTimersByTime(150);
    expect(visibleStep()).toBe('age');
    expect(steps).toHaveLength(1);
    expect(e.getAnswers()['goal']).toBe('fert');
  });

  it('never auto-submits on the last step', () => {
    const e = build(RADIO_FLOW);
    let completed = 0;
    e.on('complete', () => (completed += 1));

    click('#a-ts');
    vi.advanceTimersByTime(350);
    click('#a-30s');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('result');

    // The final step is content-only, but prove the rule directly: an answer on
    // a last step must not fire completion.
    vi.advanceTimersByTime(5000);
    expect(completed).toBe(0);

    click('#submit');
    expect(completed).toBe(1);
  });

  it('does not advance while restoring persisted answers', () => {
    build(RADIO_FLOW);
    click('#a-ts');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('age');

    // A reload re-parses the same markup with the answer already in storage.
    build(RADIO_FLOW);
    vi.advanceTimersByTime(5000);
    expect(visibleStep()).toBe('goal');
  });

  it('marks the root while an advance is pending', () => {
    build(RADIO_FLOW);
    const root = document.querySelector('[data-quiz]')!;
    click('#a-ts');
    expect(root.getAttribute('data-quiz-advancing')).toBe('true');
    vi.advanceTimersByTime(350);
    expect(root.hasAttribute('data-quiz-advancing')).toBe(false);
  });

  it('manual navigation cancels a pending advance', () => {
    const e = build(RADIO_FLOW);
    const seen: string[] = [];
    e.on('step', () => seen.push(visibleStep()!));

    click('#a-ts');
    e.next(); // user hit a Next control during the pause
    expect(visibleStep()).toBe('age');

    vi.advanceTimersByTime(2000);
    expect(visibleStep()).toBe('age'); // the stale timer did not also fire
    expect(seen).toEqual(['age']);
  });

  it('destroy() stops a pending advance', () => {
    const e = build(RADIO_FLOW);
    click('#a-ts');
    e.destroy();
    vi.advanceTimersByTime(2000);
    expect(visibleStep()).toBe('goal');
  });
});

describe('auto-advance eligibility', () => {
  it('skips a step holding a checkbox question', () => {
    build(`
      <div data-quiz="q" data-quiz-advance>
        <section data-quiz-step="concerns">
          <div data-quiz-question="concerns" data-quiz-type="checkbox">
            <div data-quiz-answer="energy" id="c-energy">Energy</div>
            <div data-quiz-answer="sleep">Sleep</div>
          </div>
        </section>
        <section data-quiz-step="next-step" data-quiz-type="content"></section>
      </div>`);
    click('#c-energy');
    vi.advanceTimersByTime(2000);
    expect(visibleStep()).toBe('concerns');
  });

  it('skips a step holding a text question', () => {
    build(`
      <div data-quiz="q" data-quiz-advance>
        <section data-quiz-step="mixed">
          <div data-quiz-question="goal" data-quiz-type="radio">
            <div data-quiz-answer="ts" id="a-ts">TS</div>
          </div>
          <div data-quiz-question="name" data-quiz-type="text">
            <input data-quiz-input />
          </div>
        </section>
        <section data-quiz-step="next-step" data-quiz-type="content"></section>
      </div>`);
    click('#a-ts');
    vi.advanceTimersByTime(2000);
    expect(visibleStep()).toBe('mixed');
  });

  it('waits until every radio question on the step is answered', () => {
    build(`
      <div data-quiz="q" data-quiz-advance>
        <section data-quiz-step="pair">
          <div data-quiz-question="a" data-quiz-type="radio">
            <div data-quiz-answer="a1" id="a1">A1</div>
          </div>
          <div data-quiz-question="b" data-quiz-type="radio">
            <div data-quiz-answer="b1" id="b1">B1</div>
          </div>
        </section>
        <section data-quiz-step="next-step" data-quiz-type="content"></section>
      </div>`);
    click('#a1');
    vi.advanceTimersByTime(2000);
    expect(visibleStep()).toBe('pair');

    click('#b1');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('next-step');
  });

  it('ignores content questions when judging readiness', () => {
    build(`
      <div data-quiz="q" data-quiz-advance>
        <section data-quiz-step="intro-plus">
          <div data-quiz-question="blurb" data-quiz-type="content">Read this</div>
          <div data-quiz-question="goal" data-quiz-type="radio">
            <div data-quiz-answer="ts" id="a-ts">TS</div>
          </div>
        </section>
        <section data-quiz-step="next-step" data-quiz-type="content"></section>
      </div>`);
    click('#a-ts');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('next-step');
  });

  it('lands on the step a show-if condition opens up', () => {
    build(`
      <div data-quiz="q" data-quiz-advance>
        <section data-quiz-step="goal">
          <div data-quiz-question="goal" data-quiz-type="radio">
            <div data-quiz-answer="fert" id="a-fert">Fert</div>
            <div data-quiz-answer="ts" id="a-ts">TS</div>
          </div>
        </section>
        <section data-quiz-step="fert-only" data-quiz-type="content" data-quiz-show-if="goal=fert"></section>
        <section data-quiz-step="end" data-quiz-type="content"></section>
      </div>`);
    click('#a-fert');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('fert-only');
  });

  it('skips a conditional step the answer closes off', () => {
    build(`
      <div data-quiz="q" data-quiz-advance>
        <section data-quiz-step="goal">
          <div data-quiz-question="goal" data-quiz-type="radio">
            <div data-quiz-answer="fert" id="a-fert">Fert</div>
            <div data-quiz-answer="ts" id="a-ts">TS</div>
          </div>
        </section>
        <section data-quiz-step="fert-only" data-quiz-type="content" data-quiz-show-if="goal=fert"></section>
        <section data-quiz-step="end" data-quiz-type="content"></section>
      </div>`);
    click('#a-ts');
    vi.advanceTimersByTime(350);
    expect(visibleStep()).toBe('end');
  });
});
