// Scored results: answer points, a running total, and result bands.
//
// Attribute contract:
//   data-quiz-score="2"       on an answer: the points it adds when selected
//   data-quiz-band="4-9"      on any element: shown only while the total is
//                             inside the band. "10+" is open-ended upward.
//   data-quiz-score-total     on any element: its text becomes the total
//
// Only questions on visible steps count, so a step hidden by show-if never
// contributes points. Checkbox questions add every selected answer's points.

import { evaluateCondition } from './conditions.js';
import type { Answers, BandModel, QuestionModel, QuizModel } from './types.js';

const NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Parse a band expression into an inclusive numeric range.
 *
 * Accepts "4-9", "10+", "-2-3" (a negative lower bound) and a single number
 * "5". Returns null for anything else, which the linter reports.
 */
export function parseBand(raw: string): { min: number; max: number } | null {
  const text = raw.trim();
  const open = /^(-?\d+(?:\.\d+)?)\+$/.exec(text);
  if (open) return { min: Number(open[1]), max: Number.POSITIVE_INFINITY };
  const range = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(text);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return min <= max ? { min, max } : null;
  }
  if (NUMBER.test(text)) return { min: Number(text), max: Number(text) };
  return null;
}

/** Parse a data-quiz-score value. Null when absent or not a finite number. */
export function parseScore(raw: string | null): number | null {
  if (raw === null) return null;
  const text = raw.trim();
  if (!NUMBER.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** True when the quiz uses scoring at all (any scored answer or any band). */
export function isScored(model: QuizModel): boolean {
  return (
    model.bands.length > 0 ||
    model.questions.some((q) => q.answers.some((a) => a.scoreRaw !== null))
  );
}

function questionScore(question: QuestionModel, answers: Answers): number {
  const stored = answers[question.key];
  if (stored === undefined) return 0;
  const chosen = Array.isArray(stored) ? stored : [stored];
  let total = 0;
  for (const answer of question.answers) {
    if (answer.score !== null && chosen.includes(answer.value)) total += answer.score;
  }
  return total;
}

/** Sum the points of every selected answer on a step visible for these answers. */
export function computeScore(model: QuizModel, answers: Answers): number {
  let total = 0;
  for (const step of model.steps) {
    if (step.condition && !evaluateCondition(step.condition, answers)) continue;
    for (const question of step.questions) {
      const gate = model.conditionals.find((c) => c.el === question.el);
      if (gate && !evaluateCondition(gate.condition, answers)) continue;
      total += questionScore(question, answers);
    }
  }
  return total;
}

/**
 * The lowest and highest total the quiz can produce. Ignores show-if, so it is
 * the widest possible range.
 */
export function scoreRange(model: QuizModel): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const q of model.questions) {
    const scores = q.answers.map((a) => a.score ?? 0);
    if (scores.length === 0) continue;
    if (q.type === 'checkbox') {
      min += scores.filter((s) => s < 0).reduce((a, b) => a + b, 0);
      max += scores.filter((s) => s > 0).reduce((a, b) => a + b, 0);
    } else {
      min += Math.min(...scores);
      max += Math.max(...scores);
    }
  }
  return { min, max };
}

/** True when a total falls inside a band (inclusive). */
export function inBand(band: BandModel, total: number): boolean {
  return total >= band.min && total <= band.max;
}
