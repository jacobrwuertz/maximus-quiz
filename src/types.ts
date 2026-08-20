// Core data model for the Maximus quiz engine.
//
// Design rule: the *stable machine key* (a slug chosen by the author) is the
// data contract. Display copy lives in element inner HTML and may change freely
// without breaking aggregation or personalization logic.

/** The four authorable question types. `content` is a Text Card (no answer collected). */
export type QuestionType = 'radio' | 'checkbox' | 'text' | 'content';

/** A single answer option within a radio/checkbox question. */
export interface AnswerModel {
  /** Stable value stored when selected, e.g. "testosterone-support". */
  value: string;
  /** The element carrying data-quiz-answer. */
  el: HTMLElement;
  /** True when this option is the "Other" option (reveals a bound input). */
  isOther: boolean;
  /** The text input revealed when an "Other" option is selected, if any. */
  otherInput: HTMLInputElement | HTMLTextAreaElement | null;
}

/** A question (radio / checkbox / text / content) living inside a step. */
export interface QuestionModel {
  /** Stable key, e.g. "goal". Unique across the quiz. */
  key: string;
  type: QuestionType;
  /** The element carrying data-quiz-question. */
  el: HTMLElement;
  /** Answer options (empty for text/content questions). */
  answers: AnswerModel[];
  /** The free-text input for `text` questions. */
  textInput: HTMLInputElement | HTMLTextAreaElement | null;
}

/** A step is one screen shown at a time. */
export interface StepModel {
  /** Stable slug, e.g. "intro" or "goal". Unique across the quiz. */
  slug: string;
  el: HTMLElement;
  questions: QuestionModel[];
  /** Optional show-if condition gating the whole step. */
  condition: Condition | null;
  /**
   * Per-step auto-advance override from `data-quiz-advance`.
   * `null` means inherit the quiz-level default.
   */
  advance: boolean | null;
}

/** A parsed data-quiz-show-if expression. */
export interface Condition {
  raw: string;
  /** Question key referenced on the left-hand side. */
  key: string;
  op: ConditionOp;
  /** Right-hand operand(s). For `in` this holds the comma-separated list. */
  values: string[];
}

export type ConditionOp = '=' | '!=' | '~=' | 'in';

/** Any element carrying a data-quiz-show-if attribute (incl. steps & inline elements). */
export interface ConditionalElement {
  el: HTMLElement;
  condition: Condition;
}

/** The fully parsed quiz. */
export interface QuizModel {
  /** Quiz id from data-quiz on the root. */
  id: string;
  root: HTMLElement;
  steps: StepModel[];
  questions: QuestionModel[];
  /** Every element with a show-if condition (steps + inline elements). */
  conditionals: ConditionalElement[];
  /**
   * Quiz-level auto-advance default from `data-quiz-advance` on the root.
   * Individual steps may override it.
   */
  advance: boolean;
}

/** Aggregated answers. Single values for radio/text; arrays for checkbox. */
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

// ── Linter ──────────────────────────────────────────────────────────────────

export type LintSeverity = 'error' | 'warn' | 'info';

export interface LintFinding {
  /** Rule id, e.g. "show-if-unknown-key". */
  rule: string;
  severity: LintSeverity;
  message: string;
  /** Offending element, when one applies. */
  el?: HTMLElement;
}

export interface LintReport {
  quizId: string;
  findings: LintFinding[];
  errors: number;
  warnings: number;
  infos: number;
  /** True when there are zero error-severity findings. */
  ok: boolean;
}

/** A lint rule is a pure function over the parsed model. */
export type LintRule = (model: QuizModel) => LintFinding[];

// ── Config ────────────────────────────────────────────────────────────────--

export interface HandoffConfig {
  /**
   * Answer keys allowed to leave this origin (cookie + outbound URL params).
   * Defaults to [] — nothing carries cross-domain unless explicitly opted in.
   * Sensitive health-adjacent answers stay in localStorage by default.
   */
  carryKeys: string[];
  /** Cookie domain for cross-subdomain carry, e.g. ".maximustribe.com". */
  cookieDomain: string | null;
  /** Cookie name. */
  cookieName: string;
  /** Cookie lifetime in days. */
  cookieMaxAgeDays: number;
  /** CSS selector for outbound CTA links to decorate with carry params. */
  ctaSelector: string;
  /** URL param prefix for decorated links, e.g. "qz_" → ?qz_goal=... */
  paramPrefix: string;
}

export interface QuizConfig {
  /** Root selector or element. Defaults to the first [data-quiz] in the document. */
  root?: string | HTMLElement;
  /** localStorage key namespace. Defaults to `maximus.quiz.<id>`. */
  storageKey?: string;
  /** Run the linter on init and log to console. Defaults to true. */
  lintOnInit?: boolean;
  /** Render a visible dev overlay listing lint findings. Defaults to false. */
  devOverlay?: boolean;
  /** Cross-domain handoff config. Disabled unless carryKeys is non-empty. */
  handoff?: Partial<HandoffConfig>;
  /**
   * Advance to the next step automatically when a radio answer completes the
   * current step. Overrides `data-quiz-advance` on the root when set.
   * Never triggers submit — the last step always needs an explicit control.
   */
  autoAdvance?: boolean;
  /**
   * Pause before an auto-advance, in milliseconds, so the selection is visible
   * before the step changes. Defaults to 350.
   */
  autoAdvanceDelay?: number;
}

export type QuizEventName = 'step' | 'answer' | 'complete';

export interface QuizEvent {
  type: QuizEventName;
  answers: Answers;
  /** Current step slug (for 'step'); the changed question key (for 'answer'). */
  detail?: string;
}

export type QuizEventHandler = (event: QuizEvent) => void;
