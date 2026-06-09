import { beforeEach, describe, expect, it } from 'vitest';
import { parseQuiz, resolveRoot } from '../src/parser.js';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.querySelector<HTMLElement>('[data-quiz]')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('parseQuiz', () => {
  it('reads the quiz id and steps', () => {
    const root = mount(`
      <div data-quiz="finder">
        <section data-quiz-step="intro" data-quiz-type="content"></section>
        <section data-quiz-step="q1">
          <div data-quiz-question="goal" data-quiz-type="radio">
            <div data-quiz-answer="a">A</div>
            <div data-quiz-answer="b">B</div>
          </div>
        </section>
      </div>`);
    const model = parseQuiz(root);
    expect(model.id).toBe('finder');
    expect(model.steps.map((s) => s.slug)).toEqual(['intro', 'q1']);
    expect(model.questions).toHaveLength(1);
    expect(model.questions[0]!.answers.map((a) => a.value)).toEqual(['a', 'b']);
  });

  it('detects the Other option and its bound input', () => {
    const root = mount(`
      <div data-quiz="q">
        <section data-quiz-step="s">
          <div data-quiz-question="format" data-quiz-type="radio">
            <div data-quiz-answer="other" data-quiz-other>
              Other <input data-quiz-input type="text" />
            </div>
          </div>
        </section>
      </div>`);
    const other = parseQuiz(root).questions[0]!.answers[0]!;
    expect(other.isOther).toBe(true);
    expect(other.otherInput).toBeInstanceOf(HTMLInputElement);
  });

  it('binds a text question input that is not inside an answer', () => {
    const root = mount(`
      <div data-quiz="q">
        <section data-quiz-step="s">
          <div data-quiz-question="name" data-quiz-type="text">
            <input data-quiz-input type="text" />
          </div>
        </section>
      </div>`);
    const q = parseQuiz(root).questions[0]!;
    expect(q.type).toBe('text');
    expect(q.textInput).toBeInstanceOf(HTMLInputElement);
  });

  it('collects step-level and inline conditionals', () => {
    const root = mount(`
      <div data-quiz="q">
        <section data-quiz-step="a"><div data-quiz-question="goal" data-quiz-type="radio"><div data-quiz-answer="x">x</div></div></section>
        <section data-quiz-step="b" data-quiz-show-if="goal=x"></section>
        <p data-quiz-show-if="goal=x">inline</p>
      </div>`);
    const model = parseQuiz(root);
    expect(model.conditionals).toHaveLength(2);
  });

  it('infers type when data-quiz-type is omitted', () => {
    const root = mount(`
      <div data-quiz="q"><section data-quiz-step="s">
        <div data-quiz-question="goal"><div data-quiz-answer="x">x</div></div>
      </section></div>`);
    expect(parseQuiz(root).questions[0]!.type).toBe('radio');
  });
});

describe('resolveRoot', () => {
  it('falls back to the first [data-quiz]', () => {
    mount('<div data-quiz="q"></div>');
    expect(resolveRoot()).toBeInstanceOf(HTMLElement);
  });
});
