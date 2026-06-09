// The self-diagnosis subsystem.
//
// Treats the quiz markup as infrastructure: runs every rule over the parsed
// model, returns a structured report, and surfaces grouped console output so a
// misconfigured personalization (e.g. a Text Card behind an answer that doesn't
// exist) is caught the moment the page loads — not in production analytics.

import { ALL_RULES } from './rules/index.js';
import type { LintFinding, LintReport, LintRule, QuizModel } from './types.js';

const PREFIX = '[maximus-quiz]';

/** Run rules over the model and build a report. */
export function lint(model: QuizModel, rules: LintRule[] = ALL_RULES): LintReport {
  const findings: LintFinding[] = [];
  for (const rule of rules) {
    try {
      findings.push(...rule(model));
    } catch (err) {
      findings.push({
        rule: 'rule-crash',
        severity: 'error',
        message: `lint rule threw: ${(err as Error).message}`,
      });
    }
  }
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warn').length;
  const infos = findings.filter((f) => f.severity === 'info').length;
  return { quizId: model.id, findings, errors, warnings, infos, ok: errors === 0 };
}

/** Emit a report to the console, grouped by severity. */
export function reportToConsole(report: LintReport): void {
  const { quizId, findings, errors, warnings, infos } = report;
  if (findings.length === 0) {
    console.info(`${PREFIX} "${quizId}" lint: clean ✓`);
    return;
  }

  const header = `${PREFIX} "${quizId}" lint: ${errors} error(s), ${warnings} warning(s), ${infos} info`;
  const group = (console.groupCollapsed ?? console.log).bind(console);
  group(header);
  for (const f of findings) {
    const line = `[${f.rule}] ${f.message}`;
    if (f.severity === 'error') console.error(line, f.el ?? '');
    else if (f.severity === 'warn') console.warn(line, f.el ?? '');
    else console.info(line, f.el ?? '');
  }
  (console.groupEnd ?? (() => undefined)).call(console);
}

/** Render a visible dev overlay listing findings (opt-in). */
export function renderOverlay(report: LintReport, root: HTMLElement): void {
  const existing = root.querySelector('[data-quiz-lint-overlay]');
  if (existing) existing.remove();
  if (report.findings.length === 0) return;

  const box = document.createElement('div');
  box.setAttribute('data-quiz-lint-overlay', '');
  box.style.cssText =
    'position:fixed;bottom:12px;right:12px;max-width:380px;max-height:50vh;overflow:auto;' +
    'background:#112F5B;color:#fff;font:12px/1.4 ui-monospace,monospace;padding:12px 14px;' +
    'border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35);z-index:99999;';
  const title = document.createElement('strong');
  title.textContent = `quiz lint — ${report.errors} err / ${report.warnings} warn`;
  box.appendChild(title);
  for (const f of report.findings) {
    const row = document.createElement('div');
    const color = f.severity === 'error' ? '#ff8a80' : f.severity === 'warn' ? '#ffd54f' : '#81ADE0';
    row.style.cssText = `margin-top:6px;color:${color};`;
    row.textContent = `[${f.rule}] ${f.message}`;
    box.appendChild(row);
  }
  root.appendChild(box);
}
