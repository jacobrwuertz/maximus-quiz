// Public API + auto-init.
//
// Usage (bundler):    import { Quiz } from '@maximus/quiz';  Quiz.init({...});
// Usage (script tag): <script src="maximus-quiz.iife.js"></script> auto-inits the
//                     first [data-quiz] on DOMContentLoaded; window.MaximusQuiz.init
//                     is available for explicit control.

import { QuizEngine } from './engine.js';
import { lint, renderOverlay, reportToConsole } from './linter.js';
import { parseQuiz, resolveRoot } from './parser.js';
import type { Answers, LintReport, QuizConfig, QuizEventHandler, QuizEventName } from './types.js';

export interface QuizInstance {
  readonly id: string;
  readonly engine: QuizEngine;
  /** Re-run the linter on demand. */
  lint(): LintReport;
  getAnswers(): Answers;
  on(type: QuizEventName, handler: QuizEventHandler): () => void;
  next(): void;
  back(): void;
  goTo(slug: string): void;
}

function create(config: QuizConfig = {}): QuizInstance | null {
  const root = resolveRoot(config.root);
  if (!root) {
    console.error('[maximus-quiz] no [data-quiz] root found.');
    return null;
  }

  const model = parseQuiz(root);

  const runLint = (): LintReport => {
    const report = lint(model);
    reportToConsole(report);
    if (config.devOverlay) renderOverlay(report, root);
    return report;
  };

  if (config.lintOnInit !== false) runLint();

  const engine = new QuizEngine(model, config);
  engine.start();

  return {
    id: model.id,
    engine,
    lint: runLint,
    getAnswers: () => engine.getAnswers(),
    on: (type, handler) => engine.on(type, handler),
    next: () => engine.next(),
    back: () => engine.back(),
    goTo: (slug) => engine.goTo(slug),
  };
}

/** Initialize a quiz. Exposed top-level so the script-tag global is `MaximusQuiz.init(...)`. */
export function init(config: QuizConfig = {}): QuizInstance | null {
  return create(config);
}

/** Lint a root without starting the engine — handy for CI / dev checks. */
export function lintOnly(root?: string | HTMLElement): LintReport | null {
  const el = resolveRoot(root);
  if (!el) return null;
  const report = lint(parseQuiz(el));
  reportToConsole(report);
  return report;
}

/** Grouped namespace for bundler consumers who prefer `Quiz.init(...)`. */
export const Quiz = { init, lintOnly };

// Re-export the building blocks for advanced consumers and tests.
export { parseQuiz, resolveRoot } from './parser.js';
export { QuizEngine } from './engine.js';
export { AnswerStore } from './store.js';
export { lint, reportToConsole, renderOverlay } from './linter.js';
export { ALL_RULES } from './rules/index.js';
export { parseCondition, evaluateCondition, matches } from './conditions.js';
export { applyHandoff, decorateHref, writeCookie, readCookie, carryPayload } from './handoff.js';
export type * from './types.js';

// Auto-init for the script-tag path: only when a [data-quiz] with
// data-quiz-auto is present, so embedding the script doesn't force init.
function autoInit(): void {
  const auto = document.querySelector<HTMLElement>('[data-quiz][data-quiz-auto]');
  if (auto) create({ root: auto, devOverlay: auto.hasAttribute('data-quiz-dev') });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
}
