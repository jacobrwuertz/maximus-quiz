import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyHandoff,
  carryPayload,
  decorateHref,
  readCookie,
  writeCookie,
} from '../src/handoff.js';
import { DEFAULT_HANDOFF } from '../src/handoff.js';
import type { HandoffConfig } from '../src/types.js';

const cfg = (over: Partial<HandoffConfig>): HandoffConfig => ({ ...DEFAULT_HANDOFF, ...over });

beforeEach(() => {
  document.body.innerHTML = '';
  // clear cookies
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]!.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  });
});

describe('carryPayload (allowlist)', () => {
  it('keeps only allowlisted keys', () => {
    const answers = { goal: 'x', secret: 'phi', concerns: ['energy'] };
    expect(carryPayload(answers, ['goal'])).toEqual({ goal: 'x' });
  });

  it('empty allowlist carries nothing', () => {
    expect(carryPayload({ goal: 'x' }, [])).toEqual({});
  });
});

describe('decorateHref', () => {
  it('appends prefixed params for allowlisted keys only', () => {
    const href = decorateHref(
      'https://app.maximustribe.com/testosterone-start',
      { goal: 'testosterone-support', secret: 'phi' },
      cfg({ carryKeys: ['goal'], paramPrefix: 'qz_' }),
    );
    const url = new URL(href);
    expect(url.searchParams.get('qz_goal')).toBe('testosterone-support');
    expect(url.searchParams.has('qz_secret')).toBe(false);
  });

  it('flattens checkbox arrays to comma lists', () => {
    const href = decorateHref(
      'https://app.maximustribe.com/x',
      { concerns: ['energy', 'libido'] },
      cfg({ carryKeys: ['concerns'] }),
    );
    expect(new URL(href).searchParams.get('qz_concerns')).toBe('energy,libido');
  });

  it('returns the href unchanged when nothing is allowlisted', () => {
    const href = 'https://app.maximustribe.com/x';
    expect(decorateHref(href, { goal: 'x' }, cfg({ carryKeys: [] }))).toBe(href);
  });
});

describe('writeCookie / readCookie', () => {
  it('round-trips the allowlisted payload', () => {
    writeCookie({ goal: 'x', secret: 'no' }, cfg({ carryKeys: ['goal'], cookieName: 'mx_quiz' }));
    expect(readCookie('mx_quiz')).toEqual({ goal: 'x' });
  });

  it('writes nothing when allowlist yields an empty payload', () => {
    writeCookie({ secret: 'no' }, cfg({ carryKeys: ['goal'], cookieName: 'mx_quiz' }));
    expect(readCookie('mx_quiz')).toEqual({});
  });
});

describe('applyHandoff', () => {
  it('decorates CTA links idempotently (no param stacking)', () => {
    document.body.innerHTML = `<a data-quiz-cta href="https://app.maximustribe.com/start">go</a>`;
    const c = cfg({ carryKeys: ['goal'], ctaSelector: '[data-quiz-cta]' });
    applyHandoff(document, { goal: 'a' }, c);
    applyHandoff(document, { goal: 'b' }, c); // answer changed
    const link = document.querySelector<HTMLAnchorElement>('[data-quiz-cta]')!;
    const url = new URL(link.href);
    expect(url.searchParams.getAll('qz_goal')).toEqual(['b']); // single, not stacked
  });

  it('is a no-op with an empty allowlist', () => {
    document.body.innerHTML = `<a data-quiz-cta href="/start">go</a>`;
    applyHandoff(document, { goal: 'a' }, cfg({ carryKeys: [] }));
    expect(document.querySelector<HTMLAnchorElement>('[data-quiz-cta]')!.getAttribute('href')).toBe(
      '/start',
    );
  });
});
