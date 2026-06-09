// ERROR: a data-quiz-show-if condition references a question key that does not
// exist. This is the classic "personalized card behind a dead answer" bug —
// the card would silently never show.
import type { LintFinding, LintRule } from '../types.js';
import { questionsByKey } from './helpers.js';

export const showIfUnknownKey: LintRule = (model) => {
  const known = questionsByKey(model);
  const findings: LintFinding[] = [];
  for (const { el, condition } of model.conditionals) {
    if (!known.has(condition.key)) {
      findings.push({
        rule: 'show-if-unknown-key',
        severity: 'error',
        message: `show-if "${condition.raw}" references unknown question key "${condition.key}". This element will never show.`,
        el,
      });
    }
  }
  return findings;
};
