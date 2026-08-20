// Scan author-supplied markup into a normalized QuizModel.
//
// The engine and linter both operate on the model, never on the DOM directly —
// so the attribute contract lives here in exactly one place.

import { parseCondition } from './conditions.js';
import type {
  AnswerModel,
  ConditionalElement,
  QuestionModel,
  QuestionType,
  QuizModel,
  StepModel,
} from './types.js';

const SEL = {
  root: '[data-quiz]',
  step: '[data-quiz-step]',
  question: '[data-quiz-question]',
  type: 'data-quiz-type',
  answer: '[data-quiz-answer]',
  other: '[data-quiz-other]',
  input: '[data-quiz-input]',
  showIf: '[data-quiz-show-if]',
  advance: 'data-quiz-advance',
} as const;

const VALID_TYPES: QuestionType[] = ['radio', 'checkbox', 'text', 'content'];

function isInputEl(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Elements matching `selector` inside `root` whose nearest `ownerSel` is `owner`. */
function scopedTo(owner: HTMLElement, selector: string, ownerSel: string): HTMLElement[] {
  return Array.from(owner.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => el.closest(ownerSel) === owner,
  );
}

function resolveType(questionEl: HTMLElement, answers: AnswerModel[], hasTextInput: boolean): QuestionType {
  const declared = questionEl.getAttribute(SEL.type)?.trim() as QuestionType | undefined;
  if (declared && VALID_TYPES.includes(declared)) return declared;
  // Inference fallback (the linter flags a missing explicit type).
  if (answers.length > 0) return 'radio';
  if (hasTextInput) return 'text';
  return 'content';
}

function parseAnswer(answerEl: HTMLElement): AnswerModel {
  const isOther = answerEl.matches(SEL.other) || answerEl.querySelector(SEL.other) !== null;
  // An Other option's bound input is the data-quiz-input within the answer element.
  const inputEl = answerEl.querySelector(SEL.input);
  return {
    value: answerEl.getAttribute('data-quiz-answer')?.trim() ?? '',
    el: answerEl,
    isOther,
    otherInput: isInputEl(inputEl) ? inputEl : null,
  };
}

function parseQuestion(questionEl: HTMLElement): QuestionModel {
  const answerEls = scopedTo(questionEl, SEL.answer, SEL.question);
  const answers = answerEls.map(parseAnswer);

  // A text question's input is a data-quiz-input that is NOT inside an answer
  // (those belong to Other options).
  const textInputEl = Array.from(questionEl.querySelectorAll<HTMLElement>(SEL.input)).find(
    (el) => el.closest(SEL.answer) === null && el.closest(SEL.question) === questionEl,
  );
  const textInput = isInputEl(textInputEl ?? null) ? (textInputEl as HTMLInputElement) : null;

  return {
    key: questionEl.getAttribute('data-quiz-question')?.trim() ?? '',
    type: resolveType(questionEl, answers, textInput !== null),
    el: questionEl,
    answers,
    textInput,
  };
}

/**
 * Read a `data-quiz-advance` flag.
 *
 * Absent → `null` (inherit). Present-but-empty or "true" → `true`.
 * "false" / "off" / "0" → `false`. Anything else is treated as opt-in, since
 * the attribute's presence is itself the author's intent.
 */
function parseAdvanceFlag(el: HTMLElement): boolean | null {
  if (!el.hasAttribute(SEL.advance)) return null;
  const raw = el.getAttribute(SEL.advance)?.trim().toLowerCase() ?? '';
  if (raw === 'false' || raw === 'off' || raw === '0') return false;
  return true;
}

function parseStep(stepEl: HTMLElement): StepModel {
  const questionEls = scopedTo(stepEl, SEL.question, SEL.step);
  const showIf = stepEl.getAttribute('data-quiz-show-if');
  return {
    slug: stepEl.getAttribute('data-quiz-step')?.trim() ?? '',
    el: stepEl,
    questions: questionEls.map(parseQuestion),
    condition: showIf ? parseCondition(showIf) : null,
    advance: parseAdvanceFlag(stepEl),
  };
}

/** Parse a quiz root element into a QuizModel. */
export function parseQuiz(root: HTMLElement): QuizModel {
  const stepEls = Array.from(root.querySelectorAll<HTMLElement>(SEL.step)).filter(
    (el) => el.closest(SEL.root) === root,
  );
  const steps = stepEls.map(parseStep);
  const questions = steps.flatMap((s) => s.questions);

  const conditionals: ConditionalElement[] = Array.from(
    root.querySelectorAll<HTMLElement>(SEL.showIf),
  )
    .map((el) => {
      const condition = parseCondition(el.getAttribute('data-quiz-show-if') ?? '');
      return condition ? { el, condition } : null;
    })
    .filter((c): c is ConditionalElement => c !== null);

  return {
    id: root.getAttribute('data-quiz')?.trim() || 'quiz',
    root,
    steps,
    questions,
    conditionals,
    advance: parseAdvanceFlag(root) ?? false,
  };
}

/** Resolve the configured root to an element, or null. */
export function resolveRoot(root?: string | HTMLElement): HTMLElement | null {
  if (root instanceof HTMLElement) return root;
  if (typeof root === 'string') return document.querySelector<HTMLElement>(root);
  return document.querySelector<HTMLElement>(SEL.root);
}

export { SEL };
