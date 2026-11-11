// Compare what actually shipped against what we meant to ship.
//
// Two things go wrong between a definition and a published Webflow page, and
// both fail SILENTLY — the page still renders, so nothing looks broken:
//
//   1. A `data-quiz-*` attribute never lands, usually because someone applied
//      it element-by-element instead of inserting one HTML block. The quiz then
//      skips a question, or stores answers under the wrong key.
//   2. A class is dropped, because Webflow discards class names in inserted
//      HTML when no matching style exists yet. The quiz works but is unstyled.
//
// This module reads the published DOM and reports both, plus the full lint
// report from the engine's own rule set. It takes a DOM element rather than an
// HTML string so `src/` keeps its zero-dependency promise; the CLI wrapper
// supplies the parser.

import { lint } from '../linter.js';
import { parseQuiz } from '../parser.js';
import type { LintReport } from '../types.js';
import type { QuizDefinition } from './webflow.js';

export interface VerifyProblem {
  kind:
    | 'missing-step'
    | 'missing-question'
    | 'wrong-type'
    | 'missing-answer'
    | 'wrong-score'
    | 'missing-band'
    | 'missing-class'
    | 'missing-root'
    | 'wrong-id';
  /** What we expected to find. */
  expected: string;
  /** Human-readable detail. */
  detail: string;
}

export interface VerifyReport {
  /** True when nothing is missing and the linter found no errors. */
  ok: boolean;
  quizId: string;
  problems: VerifyProblem[];
  /** The engine's own lint report over the published markup. */
  lint: LintReport | null;
  /** Counts for a one-line summary. */
  counts: { steps: number; questions: number; answers: number };
}

/**
 * Verify a published quiz against the definition it was generated from.
 *
 * @param root      The `[data-quiz]` element from the published page.
 * @param def       The definition the page was built from.
 * @param expectedClasses Classes returned by `generateWebflowQuiz`. Pass them
 *                  to catch Webflow's silent class-dropping; omit to skip that
 *                  check.
 */
export function verifyQuizMarkup(
  root: HTMLElement | null,
  def: QuizDefinition,
  expectedClasses: string[] = [],
): VerifyReport {
  const problems: VerifyProblem[] = [];

  if (!root) {
    return {
      ok: false,
      quizId: def.id,
      problems: [
        {
          kind: 'missing-root',
          expected: `[data-quiz="${def.id}"]`,
          detail:
            'No quiz root found on the page. The whole block is missing, or data-quiz never landed.',
        },
      ],
      lint: null,
      counts: { steps: 0, questions: 0, answers: 0 },
    };
  }

  const actualId = root.getAttribute('data-quiz')?.trim() ?? '';
  if (actualId !== def.id) {
    problems.push({
      kind: 'wrong-id',
      expected: def.id,
      detail: `Quiz root carries id "${actualId}". Stored answers namespace by id, so this splits the data.`,
    });
  }

  let answerCount = 0;
  let questionCount = 0;

  for (const step of def.steps) {
    const stepEl = root.querySelector<HTMLElement>(`[data-quiz-step="${CSS_escape(step.slug)}"]`);
    if (!stepEl) {
      problems.push({
        kind: 'missing-step',
        expected: `data-quiz-step="${step.slug}"`,
        detail: `Step "${step.slug}" is not on the page.`,
      });
      continue;
    }

    for (const question of step.questions ?? []) {
      questionCount += 1;
      const qEl = root.querySelector<HTMLElement>(
        `[data-quiz-question="${CSS_escape(question.key)}"]`,
      );
      if (!qEl) {
        problems.push({
          kind: 'missing-question',
          expected: `data-quiz-question="${question.key}"`,
          detail: `Question "${question.key}" (step "${step.slug}") is not on the page.`,
        });
        continue;
      }

      const actualType = qEl.getAttribute('data-quiz-type')?.trim();
      if (actualType !== question.type) {
        problems.push({
          kind: 'wrong-type',
          expected: `data-quiz-type="${question.type}"`,
          detail: `Question "${question.key}" has type "${actualType ?? '(none)'}". A missing type falls back to inference and may capture the wrong shape.`,
        });
      }

      for (const answer of question.answers ?? []) {
        answerCount += 1;
        const aEl = qEl.querySelector(`[data-quiz-answer="${CSS_escape(answer.value)}"]`);
        if (!aEl) {
          problems.push({
            kind: 'missing-answer',
            expected: `data-quiz-answer="${answer.value}"`,
            detail: `Answer "${answer.value}" is missing from question "${question.key}".`,
          });
        } else if (answer.score !== undefined) {
          const actual = aEl.getAttribute('data-quiz-score');
          if (actual === null || Number(actual) !== answer.score) {
            problems.push({
              kind: 'wrong-score',
              expected: `data-quiz-score="${answer.score}"`,
              detail: `Answer "${answer.value}" (question "${question.key}") scores "${actual ?? '(none)'}". A dropped score silently moves people into the wrong result.`,
            });
          }
        }
      }
    }
  }

  // Result bands: each must survive with its exact range.
  for (const step of def.steps) {
    for (const band of step.bands ?? []) {
      if (!root.querySelector(`[data-quiz-band="${CSS_escape(band.range)}"]`)) {
        problems.push({
          kind: 'missing-band',
          expected: `data-quiz-band="${band.range}"`,
          detail: `Result band "${band.range}" (step "${step.slug}") is not on the page.`,
        });
      }
    }
  }

  // Webflow drops class names that have no matching style. The element stays,
  // so this is invisible without an explicit check.
  for (const className of expectedClasses) {
    if (!root.querySelector(`.${CSS_escape(className)}`) && !root.classList.contains(className)) {
      problems.push({
        kind: 'missing-class',
        expected: `.${className}`,
        detail: `Class "${className}" appears nowhere. Webflow drops classes with no matching style — create the style, then re-insert.`,
      });
    }
  }

  const lintReport = lint(parseQuiz(root));

  return {
    ok: problems.length === 0 && lintReport.ok,
    quizId: actualId || def.id,
    problems,
    lint: lintReport,
    counts: {
      steps: def.steps.length,
      questions: questionCount,
      answers: answerCount,
    },
  };
}

/**
 * Escape a value for use inside a CSS attribute selector.
 *
 * `CSS.escape` is not available in every DOM implementation this runs under, so
 * this covers the characters that realistically appear in a slug or class.
 */
function CSS_escape(value: string): string {
  return value.replace(/["\\\]]/g, '\\$&');
}

/** Render a verify report as plain text for a terminal or CI log. */
export function formatVerifyReport(report: VerifyReport): string {
  const lines: string[] = [];
  const { counts } = report;

  lines.push(
    `quiz "${report.quizId}" — ${counts.steps} steps, ${counts.questions} questions, ${counts.answers} answers`,
  );

  if (report.problems.length === 0) {
    lines.push('✓ every expected step, question, answer and class is present');
  } else {
    lines.push(`✗ ${report.problems.length} missing or wrong:`);
    for (const p of report.problems) {
      lines.push(`  [${p.kind}] ${p.detail}`);
    }
  }

  if (report.lint) {
    const { errors, warnings, infos } = report.lint;
    lines.push(`lint: ${errors} errors, ${warnings} warnings, ${infos} infos`);
    for (const f of report.lint.findings) {
      if (f.severity === 'error') lines.push(`  [lint:${f.rule}] ${f.message}`);
    }
  }

  lines.push(report.ok ? 'RESULT: pass' : 'RESULT: FAIL');
  return lines.join('\n');
}
