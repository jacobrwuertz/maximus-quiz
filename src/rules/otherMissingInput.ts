// ERROR: an "Other" option (data-quiz-other) has no bound text input, so the
// customized answer can't be captured.
import type { LintFinding, LintRule } from '../types.js';

export const otherMissingInput: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    for (const a of q.answers) {
      if (a.isOther && !a.otherInput) {
        findings.push({
          rule: 'other-missing-input',
          severity: 'error',
          message: `Other option "${a.value}" in question "${q.key}" has no [data-quiz-input] to capture the custom value.`,
          el: a.el,
        });
      }
    }
  }
  return findings;
};
