// Shared helpers for lint rules. Rules stay pure functions over the QuizModel.
import type { QuestionModel, QuizModel } from '../types.js';

export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Map of question key → question (last wins; duplicates caught by their own rule). */
export function questionsByKey(model: QuizModel): Map<string, QuestionModel> {
  const map = new Map<string, QuestionModel>();
  for (const q of model.questions) map.set(q.key, q);
  return map;
}

/** The set of answer values declared under a question. */
export function answerValues(question: QuestionModel): Set<string> {
  return new Set(question.answers.map((a) => a.value));
}

/** Index of the step that contains an element, or -1 if none. */
export function stepIndexOf(model: QuizModel, el: HTMLElement): number {
  const stepEl = el.closest<HTMLElement>('[data-quiz-step]');
  if (!stepEl) return -1;
  return model.steps.findIndex((s) => s.el === stepEl);
}
