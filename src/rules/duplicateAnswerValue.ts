// ERROR: a single question offers the same answer value twice.
import type { LintFinding, LintRule } from '../types.js';

export const duplicateAnswerValue: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    const seen = new Map<string, number>();
    for (const a of q.answers) {
      if (!a.value) continue; // empty handled by emptyKey
      seen.set(a.value, (seen.get(a.value) ?? 0) + 1);
    }
    for (const [value, count] of seen) {
      if (count > 1) {
        findings.push({
          rule: 'duplicate-answer-value',
          severity: 'error',
          message: `question "${q.key}" offers answer "${value}" ${count} times.`,
          el: q.el,
        });
      }
    }
  }
  return findings;
};
