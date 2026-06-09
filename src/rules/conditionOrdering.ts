// WARN: a show-if element references a question that lives on a LATER step than
// the element itself. The answer isn't collected yet when the element is shown,
// so the condition is effectively unreachable on first pass.
import type { LintFinding, LintRule } from '../types.js';
import { questionsByKey, stepIndexOf } from './helpers.js';

export const conditionOrdering: LintRule = (model) => {
  const known = questionsByKey(model);
  const findings: LintFinding[] = [];
  for (const { el, condition } of model.conditionals) {
    const question = known.get(condition.key);
    if (!question) continue; // unknown key handled elsewhere
    const elStep = stepIndexOf(model, el);
    const qStep = stepIndexOf(model, question.el);
    if (elStep === -1 || qStep === -1) continue;
    if (qStep > elStep) {
      findings.push({
        rule: 'condition-ordering',
        severity: 'warn',
        message: `show-if "${condition.raw}" depends on question "${condition.key}" which appears on a later step; the answer won't exist yet when this element is evaluated.`,
        el,
      });
    }
  }
  return findings;
};
