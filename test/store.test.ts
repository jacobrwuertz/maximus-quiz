import { beforeEach, describe, expect, it } from 'vitest';
import { AnswerStore } from '../src/store.js';

beforeEach(() => localStorage.clear());

describe('AnswerStore', () => {
  it('sets and reads single values', () => {
    const s = new AnswerStore('q');
    s.set('goal', 'x');
    expect(s.get('goal')).toBe('x');
    expect(s.all()).toEqual({ goal: 'x' });
  });

  it('toggles checkbox values into arrays', () => {
    const s = new AnswerStore('q');
    s.toggle('concerns', 'energy', true);
    s.toggle('concerns', 'libido', true);
    expect(s.get('concerns')).toEqual(['energy', 'libido']);
    s.toggle('concerns', 'energy', false);
    expect(s.get('concerns')).toEqual(['libido']);
  });

  it('persists to localStorage under the namespaced key', () => {
    new AnswerStore('finder').set('goal', 'x');
    expect(localStorage.getItem('maximus.quiz.finder')).toContain('"goal":"x"');
  });

  it('rehydrates from localStorage', () => {
    localStorage.setItem('maximus.quiz.finder', JSON.stringify({ goal: 'y' }));
    expect(new AnswerStore('finder').get('goal')).toBe('y');
  });

  it('honors a custom storage key', () => {
    new AnswerStore('finder', 'custom.key').set('a', 'b');
    expect(localStorage.getItem('custom.key')).toContain('"a":"b"');
  });

  it('survives corrupt stored payloads', () => {
    localStorage.setItem('maximus.quiz.finder', '{not json');
    expect(new AnswerStore('finder').all()).toEqual({});
  });

  it('clears', () => {
    const s = new AnswerStore('finder');
    s.set('a', 'b');
    s.clear();
    expect(s.all()).toEqual({});
    expect(localStorage.getItem('maximus.quiz.finder')).toBeNull();
  });

  it('all() returns a defensive copy', () => {
    const s = new AnswerStore('q');
    s.set('a', 'b');
    const copy = s.all();
    copy.a = 'mutated';
    expect(s.get('a')).toBe('b');
  });
});
