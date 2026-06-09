// Lower-severity hygiene rules bundled together; each is still an independent
// pure LintRule export.
import type { LintFinding, LintRule } from '../types.js';
import { KEBAB } from './helpers.js';

/** ERROR: a question or answer has an empty stable key/value. */
export const emptyKey: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    if (!q.key) {
      findings.push({
        rule: 'empty-key',
        severity: 'error',
        message: 'question is missing a data-quiz-question key.',
        el: q.el,
      });
    }
    for (const a of q.answers) {
      if (!a.value) {
        findings.push({
          rule: 'empty-key',
          severity: 'error',
          message: `answer in question "${q.key}" has an empty data-quiz-answer value.`,
          el: a.el,
        });
      }
    }
  }
  return findings;
};

/** ERROR: the quiz has no steps at all. */
export const noSteps: LintRule = (model) => {
  if (model.steps.length > 0) return [];
  return [
    {
      rule: 'no-steps',
      severity: 'error',
      message: `quiz "${model.id}" has no [data-quiz-step] screens.`,
      el: model.root,
    },
  ];
};

/** INFO: a question element omits an explicit data-quiz-type (type was inferred). */
export const missingType: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    if (!q.el.hasAttribute('data-quiz-type')) {
      findings.push({
        rule: 'missing-type',
        severity: 'info',
        message: `question "${q.key}" has no data-quiz-type; inferred "${q.type}". Declare it explicitly.`,
        el: q.el,
      });
    }
  }
  return findings;
};

/** INFO: keys/values that aren't kebab-case (style consistency for data keys). */
export const kebabCase: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    if (q.key && !KEBAB.test(q.key)) {
      findings.push({
        rule: 'kebab-case',
        severity: 'info',
        message: `question key "${q.key}" is not kebab-case.`,
        el: q.el,
      });
    }
    for (const a of q.answers) {
      if (a.value && !KEBAB.test(a.value)) {
        findings.push({
          rule: 'kebab-case',
          severity: 'info',
          message: `answer value "${a.value}" (question "${q.key}") is not kebab-case.`,
          el: a.el,
        });
      }
    }
  }
  return findings;
};

/** INFO: a radio question with exactly one answer is usually a mistake. */
export const singleAnswer: LintRule = (model) => {
  const findings: LintFinding[] = [];
  for (const q of model.questions) {
    if (q.type === 'radio' && q.answers.length === 1) {
      findings.push({
        rule: 'single-answer',
        severity: 'info',
        message: `radio question "${q.key}" has only one answer; users can't make a meaningful choice.`,
        el: q.el,
      });
    }
  }
  return findings;
};
