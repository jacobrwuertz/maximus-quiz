// The quiz state machine: step navigation, answer capture, Other reveal,
// conditional visibility, progress, and event emission.
//
// Visibility uses the native `hidden` property so the engine works with zero
// CSS; the theme layers styling on top of the data-* state attributes.

import { evaluateCondition } from './conditions.js';
import { applyHandoff, DEFAULT_HANDOFF } from './handoff.js';
import { AnswerStore } from './store.js';
import type {
  AnswerModel,
  HandoffConfig,
  QuestionModel,
  QuizConfig,
  QuizEvent,
  QuizEventHandler,
  QuizEventName,
  QuizModel,
  StepModel,
} from './types.js';

export class QuizEngine {
  readonly model: QuizModel;
  readonly store: AnswerStore;
  private readonly handoff: HandoffConfig;
  private readonly handlers = new Map<QuizEventName, Set<QuizEventHandler>>();
  private index = 0;

  constructor(model: QuizModel, config: QuizConfig = {}) {
    this.model = model;
    this.store = new AnswerStore(model.id, config.storageKey);
    this.handoff = { ...DEFAULT_HANDOFF, ...(config.handoff ?? {}) };
  }

  /** Wire DOM listeners, restore persisted state, and render the first step. */
  start(): void {
    this.wireAnswers();
    this.wireInputs();
    this.wireNavigation();
    this.restoreSelections();
    this.render();
  }

  // ── Step model ──────────────────────────────────────────────────────────

  /** Steps currently visible given the answers (step-level show-if). */
  visibleSteps(): StepModel[] {
    const answers = this.store.all();
    return this.model.steps.filter(
      (s) => s.condition === null || evaluateCondition(s.condition, answers),
    );
  }

  private clampIndex(): void {
    const max = Math.max(0, this.visibleSteps().length - 1);
    if (this.index > max) this.index = max;
    if (this.index < 0) this.index = 0;
  }

  // ── Wiring ────────────────────────────────────────────────────────────────

  private wireAnswers(): void {
    for (const question of this.model.questions) {
      for (const answer of question.answers) {
        const el = answer.el;
        if (!el.hasAttribute('tabindex') && !(el instanceof HTMLButtonElement)) {
          el.setAttribute('tabindex', '0');
        }
        el.setAttribute('role', question.type === 'checkbox' ? 'checkbox' : 'radio');
        const handler = (): void => this.selectAnswer(question, answer);
        el.addEventListener('click', handler);
        el.addEventListener('keydown', (e) => {
          const ev = e as KeyboardEvent;
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            handler();
          }
        });
      }
    }
  }

  private wireInputs(): void {
    for (const question of this.model.questions) {
      if (question.textInput) {
        question.textInput.addEventListener('input', () => {
          const v = question.textInput!.value.trim();
          if (v) this.store.set(question.key, v);
          else this.store.remove(question.key);
          this.emit('answer', question.key);
          this.afterChange();
        });
      }
      for (const answer of question.answers) {
        if (answer.isOther && answer.otherInput) {
          answer.otherInput.addEventListener('input', () => {
            const v = answer.otherInput!.value.trim();
            const otherKey = `${question.key}_other`;
            if (v) this.store.set(otherKey, v);
            else this.store.remove(otherKey);
            this.emit('answer', otherKey);
            this.afterChange();
          });
        }
      }
    }
  }

  private wireNavigation(): void {
    this.model.root.querySelectorAll<HTMLElement>('[data-quiz-next]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.next();
      }),
    );
    this.model.root.querySelectorAll<HTMLElement>('[data-quiz-back]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.back();
      }),
    );
    this.model.root.querySelectorAll<HTMLElement>('[data-quiz-submit]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.submit();
      }),
    );
  }

  // ── Answer selection ────────────────────────────────────────────────────--

  private selectAnswer(question: QuestionModel, answer: AnswerModel): void {
    if (question.type === 'checkbox') {
      const isSelected = answer.el.getAttribute('data-quiz-selected') === 'true';
      this.store.toggle(question.key, answer.value, !isSelected);
      this.setSelected(answer, !isSelected);
      this.handleOther(question, answer, !isSelected);
    } else {
      // radio: single-select within the question.
      this.store.set(question.key, answer.value);
      for (const sibling of question.answers) {
        const on = sibling === answer;
        this.setSelected(sibling, on);
        this.handleOther(question, sibling, on);
      }
    }
    this.emit('answer', question.key);
    this.afterChange();
  }

  private setSelected(answer: AnswerModel, on: boolean): void {
    answer.el.setAttribute('data-quiz-selected', String(on));
    answer.el.setAttribute('aria-checked', String(on));
  }

  /** Reveal/hide an Other option's input and clear its stored value when hidden. */
  private handleOther(question: QuestionModel, answer: AnswerModel, selected: boolean): void {
    if (!answer.isOther || !answer.otherInput) return;
    answer.otherInput.hidden = !selected;
    if (selected) {
      answer.otherInput.focus();
    } else {
      answer.otherInput.value = '';
      this.store.remove(`${question.key}_other`);
    }
  }

  private restoreSelections(): void {
    for (const question of this.model.questions) {
      const stored = this.store.get(question.key);
      if (question.textInput && typeof stored === 'string') {
        question.textInput.value = stored;
      }
      for (const answer of question.answers) {
        const selected = Array.isArray(stored)
          ? stored.includes(answer.value)
          : stored === answer.value;
        this.setSelected(answer, selected);
        if (answer.isOther && answer.otherInput) {
          const otherVal = this.store.get(`${question.key}_other`);
          answer.otherInput.hidden = !selected;
          if (typeof otherVal === 'string') answer.otherInput.value = otherVal;
        }
      }
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  next(): void {
    const steps = this.visibleSteps();
    if (this.index < steps.length - 1) {
      this.index += 1;
      this.render();
      this.emit('step');
    } else {
      this.submit();
    }
  }

  back(): void {
    if (this.index > 0) {
      this.index -= 1;
      this.render();
      this.emit('step');
    }
  }

  goTo(slug: string): void {
    const idx = this.visibleSteps().findIndex((s) => s.slug === slug);
    if (idx >= 0) {
      this.index = idx;
      this.render();
      this.emit('step');
    }
  }

  submit(): void {
    // Final handoff write happens here too, so the CTA carries the full set.
    applyHandoff(this.model.root, this.store.all(), this.handoff);
    this.emit('complete');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  /** Re-apply visibility, progress, selection state, and link decoration. */
  render(): void {
    this.clampIndex();
    const steps = this.visibleSteps();
    const current = steps[this.index];

    // Show only the current step; hide all others (including condition-hidden).
    for (const step of this.model.steps) {
      step.el.hidden = step !== current;
    }

    // Inline conditional elements (show-if not on a step).
    const answers = this.store.all();
    for (const { el, condition } of this.model.conditionals) {
      if (el.matches('[data-quiz-step]')) continue; // handled above
      el.hidden = !evaluateCondition(condition, answers);
    }

    this.updateNav(steps);
    this.updateProgress(steps);
    applyHandoff(this.model.root, answers, this.handoff);
  }

  private updateNav(steps: StepModel[]): void {
    this.model.root.querySelectorAll<HTMLElement>('[data-quiz-back]').forEach((el) => {
      const atStart = this.index === 0;
      el.toggleAttribute('disabled', atStart);
      el.setAttribute('aria-disabled', String(atStart));
    });
    this.model.root.querySelectorAll<HTMLElement>('[data-quiz-next]').forEach((el) => {
      const atEnd = this.index >= steps.length - 1;
      el.hidden = atEnd; // hand off to a submit control on the last step
    });
  }

  private updateProgress(steps: StepModel[]): void {
    const total = steps.length || 1;
    const currentNum = this.index + 1;
    const pct = Math.round((currentNum / total) * 100);
    this.model.root.querySelectorAll<HTMLElement>('[data-quiz-progress]').forEach((el) => {
      el.style.setProperty('--quiz-progress', `${pct}%`);
      el.setAttribute('aria-valuenow', String(pct));
      el.setAttribute('data-quiz-progress-step', `${currentNum}/${total}`);
      const label = el.querySelector<HTMLElement>('[data-quiz-progress-label]');
      if (label) label.textContent = `${currentNum} / ${total}`;
      const bar = el.querySelector<HTMLElement>('[data-quiz-progress-bar]');
      if (bar) bar.style.width = `${pct}%`;
    });
  }

  private afterChange(): void {
    // An answer change can flip a step/inline condition, so re-render.
    this.render();
  }

  // ── Events ──────────────────────────────────────────────────────────────--

  on(type: QuizEventName, handler: QuizEventHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  private emit(type: QuizEventName, detail?: string): void {
    const event: QuizEvent = { type, answers: this.store.all() };
    if (detail !== undefined) event.detail = detail;
    this.handlers.get(type)?.forEach((h) => h(event));
    // Also surface as a DOM CustomEvent for non-JS consumers.
    this.model.root.dispatchEvent(
      new CustomEvent(`quiz:${type}`, { detail: event, bubbles: true }),
    );
  }

  getAnswers(): ReturnType<AnswerStore['all']> {
    return this.store.all();
  }
}
