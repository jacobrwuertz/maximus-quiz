// Lint rules for scored quizzes. They stay silent on a quiz with no scoring.
import type { LintFinding, LintRule } from '../types.js';
import { isScored, scoreRange } from '../scoring.js';

/** ERROR: a data-quiz-score value that is not a number. */
export const scoreInvalid: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    for (const a of q.answers) {
      if (a.scoreRaw !== null && a.score === null) {
        findings.push({
          rule: 'score-invalid',
          severity: 'error',
          message: `answer "${a.value}" (question "${q.key}") has data-quiz-score="${a.scoreRaw}", which is not a number.`,
          el: a.el,
        });
      }
    }
  }
  return findings;
};

/** ERROR: a data-quiz-band value that does not parse as "min-max", "min+" or "n". */
export const bandInvalid: LintRule = (model) =>
  model.bands
    .filter((b) => Number.isNaN(b.min) || Number.isNaN(b.max))
    .map((b) => ({
      rule: 'band-invalid',
      severity: 'error' as const,
      message: `data-quiz-band="${b.raw}" is not a range. Use "4-9", "10+" or a single number.`,
      el: b.el,
    }));

/** ERROR: result bands exist but no answer carries a score, so only a 0 band can ever show. */
export const bandWithoutScores: LintRule = (model) => {
  if (model.bands.length === 0) return [];
  const anyScore = model.questions.some((q) => q.answers.some((a) => a.score !== null));
  if (anyScore) return [];
  return [
    {
      rule: 'band-without-scores',
      severity: 'error',
      message: 'the quiz has data-quiz-band results but no answer has a data-quiz-score.',
      el: model.root,
    },
  ];
};

/**
 * WARN: a reachable integer total that no band covers (the result screen would
 * be blank), or one that two bands cover (two results would show at once).
 * Checks integer totals only, which is what whole-number scores produce.
 */
export const bandCoverage: LintRule = (model) => {
  if (!isScored(model) || model.bands.length === 0) return [];
  const valid = model.bands.filter((b) => !Number.isNaN(b.min) && !Number.isNaN(b.max));
  if (valid.length === 0) return [];
  const integral = model.questions.every((q) =>
    q.answers.every((a) => a.score === null || Number.isInteger(a.score)),
  );
  if (!integral) return [];

  const { min, max } = scoreRange(model);
  const gaps: number[] = [];
  const overlaps: number[] = [];
  for (let total = min; total <= max; total += 1) {
    const hits = valid.filter((b) => total >= b.min && total <= b.max).length;
    if (hits === 0) gaps.push(total);
    if (hits > 1) overlaps.push(total);
  }
  const findings: LintFinding[] = [];
  if (gaps.length > 0) {
    findings.push({
      rule: 'band-coverage',
      severity: 'warn',
      message: `no result band covers total(s) ${gaps.join(', ')} (possible range ${min}-${max}).`,
      el: model.root,
    });
  }
  if (overlaps.length > 0) {
    findings.push({
      rule: 'band-coverage',
      severity: 'warn',
      message: `more than one result band covers total(s) ${overlaps.join(', ')}.`,
      el: model.root,
    });
  }
  return findings;
};
