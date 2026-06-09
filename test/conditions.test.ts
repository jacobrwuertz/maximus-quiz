import { describe, expect, it } from 'vitest';
import { evaluateCondition, matches, parseCondition } from '../src/conditions.js';

describe('parseCondition', () => {
  it('parses equality', () => {
    expect(parseCondition('goal=testosterone-support')).toEqual({
      raw: 'goal=testosterone-support',
      key: 'goal',
      op: '=',
      values: ['testosterone-support'],
    });
  });

  it('parses not-equal before equal', () => {
    expect(parseCondition('goal!=fertility')?.op).toBe('!=');
  });

  it('parses contains (~=)', () => {
    expect(parseCondition('concerns~=energy')?.op).toBe('~=');
  });

  it('parses `in` lists', () => {
    expect(parseCondition('goal in a, b ,c')).toEqual({
      raw: 'goal in a, b ,c',
      key: 'goal',
      op: 'in',
      values: ['a', 'b', 'c'],
    });
  });

  it('returns null for garbage', () => {
    expect(parseCondition('')).toBeNull();
    expect(parseCondition('nokeyhere')).toBeNull();
    expect(parseCondition('=novalue')).toBeNull();
  });
});

describe('evaluateCondition', () => {
  const c = (raw: string) => parseCondition(raw)!;

  it('= matches single radio value', () => {
    expect(evaluateCondition(c('goal=x'), { goal: 'x' })).toBe(true);
    expect(evaluateCondition(c('goal=x'), { goal: 'y' })).toBe(false);
  });

  it('= matches a value within a checkbox set', () => {
    expect(evaluateCondition(c('concerns=energy'), { concerns: ['energy', 'focus'] })).toBe(true);
  });

  it('!= negates', () => {
    expect(evaluateCondition(c('goal!=x'), { goal: 'y' })).toBe(true);
    expect(evaluateCondition(c('goal!=x'), { goal: 'x' })).toBe(false);
  });

  it('~= checks set membership', () => {
    expect(evaluateCondition(c('concerns~=libido'), { concerns: ['libido'] })).toBe(true);
    expect(evaluateCondition(c('concerns~=libido'), { concerns: ['energy'] })).toBe(false);
  });

  it('in matches any of the list', () => {
    expect(evaluateCondition(c('goal in a,b'), { goal: 'b' })).toBe(true);
    expect(evaluateCondition(c('goal in a,b'), { goal: 'c' })).toBe(false);
  });

  it('missing answer is false', () => {
    expect(evaluateCondition(c('goal=x'), {})).toBe(false);
  });
});

describe('matches', () => {
  it('parses + evaluates, unparseable is false', () => {
    expect(matches('goal=x', { goal: 'x' })).toBe(true);
    expect(matches('garbage', { goal: 'x' })).toBe(false);
  });
});
