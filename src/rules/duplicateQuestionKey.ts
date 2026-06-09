// ERROR: two questions share the same stable key. Their answers would collide
// in the aggregated store.
import type { LintFinding, LintRule } from '../types.js';

export const duplicateQuestionKey: LintRule = (model) => {
  const seen = new Map<string, number>();
  for (const q of model.questions) {
    if (!q.key) continue; // empty handled by emptyKey
    seen.set(q.key, (seen.get(q.key) ?? 0) + 1);
  }
  const findings: LintFinding[] = [];
  for (const [key, count] of seen) {
    if (count > 1) {
      findings.push({
        rule: 'duplicate-question-key',
        severity: 'error',
        message: `question key "${key}" is used ${count} times. Keys must be unique; answers will collide.`,
      });
    }
  }
  return findings;
};
