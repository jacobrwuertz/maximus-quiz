// ERROR: a radio/checkbox question has no answer options — nothing to select.
import type { LintFinding, LintRule } from '../types.js';

export const emptyQuestion: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    if ((q.type === 'radio' || q.type === 'checkbox') && q.answers.length === 0) {
      findings.push({
        rule: 'empty-question',
        severity: 'error',
        message: `${q.type} question "${q.key}" has no answers ([data-quiz-answer]).`,
        el: q.el,
      });
    }
    if (q.type === 'text' && !q.textInput) {
      findings.push({
        rule: 'empty-question',
        severity: 'error',
        message: `text question "${q.key}" has no input ([data-quiz-input]).`,
        el: q.el,
      });
    }
  }
  return findings;
};
