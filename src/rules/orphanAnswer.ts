// ERROR: a [data-quiz-answer] or non-question [data-quiz-input] lives outside any
// question, so the engine can never wire or store it. Scans the DOM because
// orphans are, by definition, absent from the parsed question tree.
import type { LintFinding, LintRule } from '../types.js';

export const orphanAnswer: LintRule = (model) => {
  const findings: LintFinding[] = [];

  model.root.querySelectorAll<HTMLElement>('[data-quiz-answer]').forEach((el) => {
    if (el.closest('[data-quiz-question]') === null) {
      findings.push({
        rule: 'orphan-answer',
        severity: 'error',
        message: `answer "${el.getAttribute('data-quiz-answer')}" is not inside any [data-quiz-question].`,
        el,
      });
    }
  });

  model.root.querySelectorAll<HTMLElement>('[data-quiz-input]').forEach((el) => {
    if (el.closest('[data-quiz-question]') === null && el.closest('[data-quiz-answer]') === null) {
      findings.push({
        rule: 'orphan-answer',
        severity: 'warn',
        message: `[data-quiz-input] is not inside a question or an Other answer; it will be ignored.`,
        el,
      });
    }
  });

  return findings;
};
