// ERROR: a show-if condition references an answer value that does not exist
// under the (existing) question. Skipped for text/content questions, whose
// values are free-form and can't be enumerated.
import type { LintFinding, LintRule } from '../types.js';
import { answerValues, questionsByKey } from './helpers.js';

export const showIfUnknownValue: LintRule = (model) => {
  const known = questionsByKey(model);
  const findings: LintFinding[] = [];
  for (const { el, condition } of model.conditionals) {
    const question = known.get(condition.key);
    if (!question) continue; // unknown key handled by its own rule
    if (question.type === 'text' || question.type === 'content') continue;
    const values = answerValues(question);
    for (const v of condition.values) {
      if (!values.has(v)) {
        findings.push({
          rule: 'show-if-unknown-value',
          severity: 'error',
          message: `show-if "${condition.raw}" references value "${v}" not offered by question "${condition.key}". This element will never show.`,
          el,
        });
      }
    }
  }
  return findings;
};
