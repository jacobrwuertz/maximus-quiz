// Every lint rule gets a PASS fixture (no finding) and a FAIL fixture (asserts
// the exact rule fires). The linter is mission-critical, so coverage is total.
import { beforeEach, describe, expect, it } from 'vitest';
import { lint } from '../src/linter.js';
import { parseQuiz } from '../src/parser.js';
import {
  conditionOrdering,
  duplicateAnswerValue,
  duplicateQuestionKey,
  emptyKey,
  emptyQuestion,
  kebabCase,
  missingType,
  noSteps,
  orphanAnswer,
  otherMissingInput,
  showIfUnknownKey,
  showIfUnknownValue,
  singleAnswer,
} from '../src/rules/index.js';
import type { LintRule } from '../src/types.js';

function model(html: string) {
  document.body.innerHTML = html;
  return parseQuiz(document.querySelector<HTMLElement>('[data-quiz]')!);
}

function fires(rule: LintRule, html: string, ruleId: string): boolean {
  return rule(model(html)).some((f) => f.rule === ruleId);
}

beforeEach(() => (document.body.innerHTML = ''));

const Q = (inner: string, attrs = 'data-quiz-type="radio"') =>
  `<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-question="goal" ${attrs}>${inner}</div></section></div>`;

describe('show-if-unknown-key', () => {
  it('PASS: condition references an existing key', () => {
    expect(
      fires(
        showIfUnknownKey,
        `<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-question="goal" data-quiz-type="radio"><div data-quiz-answer="x">x</div></div></section><p data-quiz-show-if="goal=x"></p></div>`,
        'show-if-unknown-key',
      ),
    ).toBe(false);
  });
  it('FAIL: condition references a missing key', () => {
    expect(
      fires(
        showIfUnknownKey,
        `<div data-quiz="q"><section data-quiz-step="s"></section><p data-quiz-show-if="ghost=x"></p></div>`,
        'show-if-unknown-key',
      ),
    ).toBe(true);
  });
});

describe('show-if-unknown-value', () => {
  it('PASS: value exists under the question', () => {
    expect(
      fires(
        showIfUnknownValue,
        `<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-question="goal" data-quiz-type="radio"><div data-quiz-answer="x">x</div></div></section><p data-quiz-show-if="goal=x"></p></div>`,
        'show-if-unknown-value',
      ),
    ).toBe(false);
  });
  it('FAIL: value is not offered by the question', () => {
    expect(
      fires(
        showIfUnknownValue,
        `<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-question="goal" data-quiz-type="radio"><div data-quiz-answer="x">x</div></div></section><p data-quiz-show-if="goal=ghost"></p></div>`,
        'show-if-unknown-value',
      ),
    ).toBe(true);
  });
});

describe('duplicate-question-key', () => {
  it('PASS', () =>
    expect(
      fires(
        duplicateQuestionKey,
        `<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-question="a" data-quiz-type="text"><input data-quiz-input></div><div data-quiz-question="b" data-quiz-type="text"><input data-quiz-input></div></section></div>`,
        'duplicate-question-key',
      ),
    ).toBe(false));
  it('FAIL', () =>
    expect(
      fires(
        duplicateQuestionKey,
        `<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-question="a" data-quiz-type="text"><input data-quiz-input></div><div data-quiz-question="a" data-quiz-type="text"><input data-quiz-input></div></section></div>`,
        'duplicate-question-key',
      ),
    ).toBe(true));
});

describe('duplicate-answer-value', () => {
  it('PASS', () =>
    expect(fires(duplicateAnswerValue, Q('<div data-quiz-answer="x">x</div><div data-quiz-answer="y">y</div>'), 'duplicate-answer-value')).toBe(false));
  it('FAIL', () =>
    expect(fires(duplicateAnswerValue, Q('<div data-quiz-answer="x">x</div><div data-quiz-answer="x">x</div>'), 'duplicate-answer-value')).toBe(true));
});

describe('empty-question', () => {
  it('PASS', () =>
    expect(fires(emptyQuestion, Q('<div data-quiz-answer="x">x</div>'), 'empty-question')).toBe(false));
  it('FAIL: radio with no answers', () =>
    expect(fires(emptyQuestion, Q(''), 'empty-question')).toBe(true));
});

describe('orphan-answer', () => {
  it('PASS', () =>
    expect(fires(orphanAnswer, Q('<div data-quiz-answer="x">x</div>'), 'orphan-answer')).toBe(false));
  it('FAIL: answer outside any question', () =>
    expect(
      fires(
        orphanAnswer,
        `<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-answer="loose">x</div></section></div>`,
        'orphan-answer',
      ),
    ).toBe(true));
});

describe('other-missing-input', () => {
  it('PASS', () =>
    expect(
      fires(
        otherMissingInput,
        Q('<div data-quiz-answer="other" data-quiz-other>Other<input data-quiz-input></div>'),
        'other-missing-input',
      ),
    ).toBe(false));
  it('FAIL: Other without input', () =>
    expect(
      fires(otherMissingInput, Q('<div data-quiz-answer="other" data-quiz-other>Other</div>'), 'other-missing-input'),
    ).toBe(true));
});

describe('condition-ordering', () => {
  it('PASS: condition references a same/earlier step question', () =>
    expect(
      fires(
        conditionOrdering,
        `<div data-quiz="q"><section data-quiz-step="a"><div data-quiz-question="goal" data-quiz-type="radio"><div data-quiz-answer="x">x</div></div></section><section data-quiz-step="b" data-quiz-show-if="goal=x"></section></div>`,
        'condition-ordering',
      ),
    ).toBe(false));
  it('FAIL: condition references a later-step question', () =>
    expect(
      fires(
        conditionOrdering,
        `<div data-quiz="q"><section data-quiz-step="a" data-quiz-show-if="goal=x"></section><section data-quiz-step="b"><div data-quiz-question="goal" data-quiz-type="radio"><div data-quiz-answer="x">x</div></div></section></div>`,
        'condition-ordering',
      ),
    ).toBe(true));
});

describe('empty-key', () => {
  it('PASS', () => expect(fires(emptyKey, Q('<div data-quiz-answer="x">x</div>'), 'empty-key')).toBe(false));
  it('FAIL: empty answer value', () =>
    expect(fires(emptyKey, Q('<div data-quiz-answer="">x</div>'), 'empty-key')).toBe(true));
});

describe('no-steps', () => {
  it('PASS', () => expect(fires(noSteps, Q('<div data-quiz-answer="x">x</div>'), 'no-steps')).toBe(false));
  it('FAIL', () => expect(fires(noSteps, `<div data-quiz="q"></div>`, 'no-steps')).toBe(true));
});

describe('missing-type', () => {
  it('PASS: explicit type', () =>
    expect(fires(missingType, Q('<div data-quiz-answer="x">x</div>'), 'missing-type')).toBe(false));
  it('FAIL: no type attribute', () =>
    expect(fires(missingType, Q('<div data-quiz-answer="x">x</div>', ''), 'missing-type')).toBe(true));
});

describe('kebab-case', () => {
  it('PASS', () => expect(fires(kebabCase, Q('<div data-quiz-answer="all-good">x</div>'), 'kebab-case')).toBe(false));
  it('FAIL: camelCase value', () =>
    expect(fires(kebabCase, Q('<div data-quiz-answer="notKebab">x</div>'), 'kebab-case')).toBe(true));
});

describe('single-answer', () => {
  it('PASS: two answers', () =>
    expect(fires(singleAnswer, Q('<div data-quiz-answer="x">x</div><div data-quiz-answer="y">y</div>'), 'single-answer')).toBe(false));
  it('FAIL: one answer', () =>
    expect(fires(singleAnswer, Q('<div data-quiz-answer="x">x</div>'), 'single-answer')).toBe(true));
});

describe('full report', () => {
  it('aggregates counts and ok flag', () => {
    const report = lint(
      model(`<div data-quiz="q"><section data-quiz-step="s"><div data-quiz-question="goal" data-quiz-type="radio"><div data-quiz-answer="x">x</div><div data-quiz-answer="y">y</div></div></section><p data-quiz-show-if="goal=x"></p></div>`),
    );
    expect(report.ok).toBe(true);
    expect(report.errors).toBe(0);
  });

  it('flags ok=false when an error rule fires', () => {
    const report = lint(model(`<div data-quiz="q"><section data-quiz-step="s"></section><p data-quiz-show-if="ghost=x"></p></div>`));
    expect(report.ok).toBe(false);
    expect(report.errors).toBeGreaterThan(0);
  });
});
