// Cross-subdomain answer handoff.
//
// Two transports, both gated by an explicit `carryKeys` allowlist:
//   1. A cookie scoped to e.g. ".maximustribe.com" — auto-carries to subdomains.
//   2. URL params appended to outbound CTA links at click time — survives the
//      app handoff seam where the chosen offer is otherwise lost.
//
// COMPLIANCE NOTE: this is a health-adjacent quiz. Nothing leaves the origin
// unless its key is named in `carryKeys`. The full answer set stays in
// localStorage by default; authors opt specific routing keys in.

import type { Answers, HandoffConfig } from './types.js';

export const DEFAULT_HANDOFF: HandoffConfig = {
  carryKeys: [],
  cookieDomain: null,
  cookieName: 'mx_quiz',
  cookieMaxAgeDays: 30,
  ctaSelector: '[data-quiz-cta]',
  paramPrefix: 'qz_',
};

/** Reduce the full answer set to only the allowlisted carry keys. */
export function carryPayload(answers: Answers, carryKeys: string[]): Answers {
  const out: Answers = {};
  for (const key of carryKeys) {
    if (answers[key] !== undefined) out[key] = answers[key]!;
  }
  return out;
}

function flatten(value: string | string[]): string {
  return Array.isArray(value) ? value.join(',') : value;
}

/** Write the allowlisted payload to a cross-subdomain cookie. No-op if empty. */
export function writeCookie(answers: Answers, cfg: HandoffConfig): void {
  const payload = carryPayload(answers, cfg.carryKeys);
  if (Object.keys(payload).length === 0) return;

  const value = encodeURIComponent(JSON.stringify(payload));
  const maxAge = cfg.cookieMaxAgeDays * 24 * 60 * 60;
  const parts = [
    `${cfg.cookieName}=${value}`,
    'path=/',
    `max-age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (cfg.cookieDomain) parts.push(`domain=${cfg.cookieDomain}`);
  if (location.protocol === 'https:') parts.push('Secure');
  document.cookie = parts.join('; ');
}

/** Append allowlisted answers as URL params to a single href. */
export function decorateHref(href: string, answers: Answers, cfg: HandoffConfig): string {
  const payload = carryPayload(answers, cfg.carryKeys);
  if (Object.keys(payload).length === 0) return href;

  // Use a base so relative hrefs (e.g. "/testosterone-start") still parse.
  let url: URL;
  try {
    url = new URL(href, location.href);
  } catch {
    return href;
  }
  for (const [key, value] of Object.entries(payload)) {
    url.searchParams.set(`${cfg.paramPrefix}${key}`, flatten(value));
  }
  // Preserve original relative form when the host is unchanged.
  return url.href;
}

/**
 * Decorate all CTA links matching the selector and (re)write the cookie.
 * Idempotent — safe to call on every answer change and again at click time.
 */
export function applyHandoff(root: ParentNode, answers: Answers, cfg: HandoffConfig): void {
  if (cfg.carryKeys.length === 0) return;
  writeCookie(answers, cfg);
  const links = root.querySelectorAll<HTMLAnchorElement>(cfg.ctaSelector);
  links.forEach((link) => {
    const base = link.getAttribute('data-quiz-href') ?? link.getAttribute('href');
    if (!base) return;
    // Remember the undecorated href so repeated calls don't stack params.
    if (!link.hasAttribute('data-quiz-href')) link.setAttribute('data-quiz-href', base);
    link.setAttribute('href', decorateHref(base, answers, cfg));
  });
}

/** Read a previously written handoff cookie back into an Answers object. */
export function readCookie(cookieName: string): Answers {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${cookieName}=`));
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match.slice(cookieName.length + 1))) as Answers;
  } catch {
    return {};
  }
}
