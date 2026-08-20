// Turn a quiz definition into ONE block of Webflow-ready HTML.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Webflow's MCP bridge can set element attributes, but only one element at a
// time, through `set_attributes` / `set_settings`. A twelve-question quiz needs
// sixty-plus of those calls, every one of which has to land, and the call fails
// outright with a "component map" conflict on anything inside a component.
// That is where `data-quiz-*` attributes go missing in an AI-driven build.
//
// Attributes inserted as PART OF AN HTML BLOCK do not have that problem. A
// single `data_whtml_builder` insert preserves them — proven on this site by
// the native `<details>` FAQ pattern, whose `name="<page>-faq"` grouping
// attribute was verified in published HTML.
//
// So: never author quiz attributes element by element. Generate the whole
// quiz here, insert it in one call, then verify it with `verifyPublishedHtml`.
//
// ── The class trap ──────────────────────────────────────────────────────────
// Webflow SILENTLY DROPS class names in inserted HTML when no matching style
// exists yet. The element survives, the class does not, and the quiz renders
// unstyled with no error. {@link generateWebflowQuiz} therefore returns the
// full `classes` list so the caller can create every style FIRST.

/** One selectable option inside a radio or checkbox question. */
export interface AnswerDefinition {
  /** Stable machine value stored when selected, e.g. "testosterone-support". */
  value: string;
  /** Display copy. Safe to reword later without breaking stored answers. */
  label: string;
  /** Marks the "Other" option, which reveals a bound free-text input. */
  other?: boolean;
  /** Placeholder for an Other option's input. */
  placeholder?: string;
}

/** A question within a step. */
export interface QuestionDefinition {
  /** Stable machine key, e.g. "goal". Must be unique across the quiz. */
  key: string;
  type: 'radio' | 'checkbox' | 'text' | 'content';
  /** The prompt shown above the answers. */
  label?: string;
  /** Optional supporting copy under the prompt. */
  help?: string;
  /** Options for radio and checkbox questions. */
  answers?: AnswerDefinition[];
  /** Placeholder for a text question's input. */
  placeholder?: string;
  /** Inner HTML for a `content` question. */
  content?: string;
  /** Conditional display expression, e.g. "goal=fertility-preservation". */
  showIf?: string;
}

/** One screen, shown on its own. */
export interface StepDefinition {
  /** Stable slug, e.g. "goal". Must be unique across the quiz. */
  slug: string;
  heading?: string;
  body?: string;
  /** Conditional display expression gating the whole step. */
  showIf?: string;
  /** Per-step auto-advance override. */
  advance?: boolean;
  questions?: QuestionDefinition[];
  /** Label for a Next control. Omit on auto-advancing radio steps. */
  next?: string;
  /** Label for a Back control. */
  back?: string;
  /** Label for a Submit control. Use on the final step. */
  submit?: string;
}

export interface QuizDefinition {
  /** Quiz id, e.g. "testosterone-finder". Namespaces stored answers. */
  id: string;
  /** Class prefix, Client First style. Defaults to "mx-quiz". */
  classPrefix?: string;
  /** Auto-initialize on page load. Defaults to true (the embed path). */
  auto?: boolean;
  /** Enable auto-advance for the whole quiz. */
  advance?: boolean;
  /** Emit a progress bar. Defaults to true. */
  progress?: boolean;
  steps: StepDefinition[];
}

export interface GenerateResult {
  /** The single HTML block to insert. */
  html: string;
  /**
   * Every class the markup uses, in the order it appears. Create these styles
   * in Webflow BEFORE inserting, or Webflow drops them silently.
   */
  classes: string[];
  /** Authoring problems worth fixing before the build. */
  warnings: string[];
}

const DEFAULT_PREFIX = 'mx-quiz';
const INDENT = '  ';

/** Escape text for use in an HTML text node. */
function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape a value for use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

/** Build an attribute string from pairs, skipping empty values. */
function attrs(pairs: Array<[string, string | boolean | undefined]>): string {
  const out: string[] = [];
  for (const [name, value] of pairs) {
    if (value === undefined || value === false) continue;
    if (value === true) out.push(` ${name}`);
    else out.push(` ${name}="${escapeAttr(value)}"`);
  }
  return out.join('');
}

/** Collects class names in first-seen order so the caller can pre-create them. */
class ClassRegistry {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly prefix: string) {}

  /** Register and return a prefixed class, e.g. `use('step')` → `mx-quiz_step`. */
  use(suffix: string): string {
    const name = `${this.prefix}_${suffix}`;
    if (!this.seen.has(name)) {
      this.seen.add(name);
      this.order.push(name);
    }
    return name;
  }

  list(): string[] {
    return [...this.order];
  }
}

function renderAnswer(
  answer: AnswerDefinition,
  question: QuestionDefinition,
  cls: ClassRegistry,
  depth: number,
): string[] {
  const pad = INDENT.repeat(depth);
  const lines: string[] = [];

  const answerAttrs = attrs([
    ['class', cls.use('answer')],
    ['data-quiz-answer', answer.value],
    ['data-quiz-other', answer.other === true],
  ]);

  if (!answer.other) {
    lines.push(`${pad}<div${answerAttrs}>${escapeText(answer.label)}</div>`);
    return lines;
  }

  // An Other option owns the input it reveals, so the parser can bind them.
  const inputAttrs = attrs([
    ['class', cls.use('other-input')],
    ['data-quiz-input', true],
    ['type', 'text'],
    ['placeholder', answer.placeholder ?? 'Tell us more'],
    ['aria-label', `${question.label ?? question.key} — other`],
  ]);
  lines.push(`${pad}<div${answerAttrs}>`);
  lines.push(`${pad}${INDENT}<span>${escapeText(answer.label)}</span>`);
  lines.push(`${pad}${INDENT}<input${inputAttrs} />`);
  lines.push(`${pad}</div>`);
  return lines;
}

function renderQuestion(
  question: QuestionDefinition,
  cls: ClassRegistry,
  depth: number,
): string[] {
  const pad = INDENT.repeat(depth);
  const lines: string[] = [];

  lines.push(
    `${pad}<div${attrs([
      ['class', cls.use('question')],
      ['data-quiz-question', question.key],
      ['data-quiz-type', question.type],
      ['data-quiz-show-if', question.showIf],
    ])}>`,
  );

  if (question.label) {
    lines.push(
      `${pad}${INDENT}<div class="${cls.use('prompt')}">${escapeText(question.label)}</div>`,
    );
  }
  if (question.help) {
    lines.push(`${pad}${INDENT}<p class="${cls.use('help')}">${escapeText(question.help)}</p>`);
  }

  if (question.type === 'content' && question.content) {
    lines.push(`${pad}${INDENT}${question.content}`);
  }

  if (question.type === 'text') {
    lines.push(
      `${pad}${INDENT}<input${attrs([
        ['class', cls.use('input')],
        ['data-quiz-input', true],
        ['type', 'text'],
        ['placeholder', question.placeholder ?? ''],
        ['aria-label', question.label ?? question.key],
      ])} />`,
    );
  }

  const answers = question.answers ?? [];
  if (answers.length > 0) {
    lines.push(`${pad}${INDENT}<div class="${cls.use('answers')}">`);
    for (const answer of answers) {
      lines.push(...renderAnswer(answer, question, cls, depth + 2));
    }
    lines.push(`${pad}${INDENT}</div>`);
  }

  lines.push(`${pad}</div>`);
  return lines;
}

function renderNav(step: StepDefinition, cls: ClassRegistry, depth: number): string[] {
  if (!step.back && !step.next && !step.submit) return [];
  const pad = INDENT.repeat(depth);
  const lines: string[] = [`${pad}<div class="${cls.use('nav')}">`];
  const inner = INDENT.repeat(depth + 1);

  if (step.back) {
    lines.push(
      `${inner}<a href="#"${attrs([['class', cls.use('back')], ['data-quiz-back', true]])}>${escapeText(step.back)}</a>`,
    );
  }
  if (step.next) {
    lines.push(
      `${inner}<a href="#"${attrs([['class', cls.use('next')], ['data-quiz-next', true]])}>${escapeText(step.next)}</a>`,
    );
  }
  if (step.submit) {
    lines.push(
      `${inner}<a href="#"${attrs([['class', cls.use('submit')], ['data-quiz-submit', true]])}>${escapeText(step.submit)}</a>`,
    );
  }
  lines.push(`${pad}</div>`);
  return lines;
}

function renderStep(step: StepDefinition, cls: ClassRegistry, depth: number): string[] {
  const pad = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);
  const lines: string[] = [];

  lines.push(
    `${pad}<div${attrs([
      ['class', cls.use('step')],
      ['data-quiz-step', step.slug],
      ['data-quiz-show-if', step.showIf],
      ['data-quiz-advance', step.advance === undefined ? undefined : String(step.advance)],
    ])}>`,
  );

  if (step.heading) {
    lines.push(`${inner}<h2 class="${cls.use('heading')}">${escapeText(step.heading)}</h2>`);
  }
  if (step.body) {
    lines.push(`${inner}<p class="${cls.use('body')}">${escapeText(step.body)}</p>`);
  }

  const questions = step.questions ?? [];

  // Webflow rejects a whole HTML insert with "Text Field can only be placed in
  // a Form" if a text input is not inside a <form>. The failure is at insert
  // time and takes the entire block with it, so any step carrying a text
  // question wraps its questions in a form. Radio and checkbox questions are
  // plain divs, so including them is harmless and keeps the layout in one flow.
  const needsForm = questions.some((q) => q.type === 'text');

  if (needsForm) {
    lines.push(`${inner}<form class="${cls.use('form')}">`);
    for (const question of questions) {
      lines.push(...renderQuestion(question, cls, depth + 2));
    }
    lines.push(`${inner}</form>`);
  } else {
    for (const question of questions) {
      lines.push(...renderQuestion(question, cls, depth + 1));
    }
  }

  lines.push(...renderNav(step, cls, depth + 1));
  lines.push(`${pad}</div>`);
  return lines;
}

/**
 * Check a definition for problems the generator would otherwise bake into the
 * markup. This is a fast authoring check, not a replacement for the linter —
 * `verifyPublishedHtml` runs the full rule set against what actually shipped.
 */
export function validateDefinition(def: QuizDefinition): string[] {
  const warnings: string[] = [];
  const seenSteps = new Set<string>();
  const seenKeys = new Set<string>();
  const allKeys = new Set<string>();

  for (const step of def.steps) {
    for (const q of step.questions ?? []) allKeys.add(q.key);
  }

  if (def.steps.length === 0) warnings.push('Quiz has no steps.');

  for (const step of def.steps) {
    if (!step.slug) warnings.push('A step is missing its slug.');
    else if (seenSteps.has(step.slug)) warnings.push(`Duplicate step slug: "${step.slug}".`);
    seenSteps.add(step.slug);

    for (const q of step.questions ?? []) {
      if (!q.key) {
        warnings.push(`A question in step "${step.slug}" is missing its key.`);
      } else if (seenKeys.has(q.key)) {
        warnings.push(`Duplicate question key: "${q.key}".`);
      }
      seenKeys.add(q.key);

      const answers = q.answers ?? [];
      if ((q.type === 'radio' || q.type === 'checkbox') && answers.length < 2) {
        warnings.push(`Question "${q.key}" is a ${q.type} with fewer than 2 answers.`);
      }

      const seenValues = new Set<string>();
      for (const a of answers) {
        if (!a.value) warnings.push(`An answer in "${q.key}" is missing its value.`);
        else if (seenValues.has(a.value)) {
          warnings.push(`Duplicate answer value "${a.value}" in question "${q.key}".`);
        }
        seenValues.add(a.value);
      }
    }

    // A show-if can only reference a key the quiz actually collects.
    for (const expr of [step.showIf, ...(step.questions ?? []).map((q) => q.showIf)]) {
      if (!expr) continue;
      const key = expr.split(/[!~]?=| in /)[0]?.trim();
      if (key && !allKeys.has(key)) {
        warnings.push(`show-if "${expr}" references unknown question key "${key}".`);
      }
    }
  }

  // A step that auto-advances needs no Next control, and a stray one confuses
  // the reader about which control is authoritative.
  for (const step of def.steps) {
    const advancing = step.advance ?? def.advance ?? false;
    const radioOnly =
      (step.questions ?? []).filter((q) => q.type !== 'content').every((q) => q.type === 'radio') &&
      (step.questions ?? []).some((q) => q.type === 'radio');
    if (advancing && radioOnly && step.next) {
      warnings.push(
        `Step "${step.slug}" auto-advances but also declares a Next control; drop one.`,
      );
    }
  }

  return warnings;
}

/**
 * Generate the quiz as a single HTML block, plus the class list to create in
 * Webflow first.
 *
 * Insert the `html` through `data_whtml_builder` in ONE call. Do not add the
 * `data-quiz-*` attributes afterwards with `set_attributes` — that is the
 * unreliable path this function exists to replace.
 */
export function generateWebflowQuiz(def: QuizDefinition): GenerateResult {
  const cls = new ClassRegistry(def.classPrefix ?? DEFAULT_PREFIX);
  const warnings = validateDefinition(def);
  const lines: string[] = [];

  lines.push(
    `<div${attrs([
      ['class', cls.use('wrap')],
      ['data-quiz', def.id],
      ['data-quiz-auto', def.auto !== false],
      ['data-quiz-advance', def.advance === true],
    ])}>`,
  );

  if (def.progress !== false) {
    lines.push(`${INDENT}<div class="${cls.use('progress')}" data-quiz-progress>`);
    lines.push(
      `${INDENT.repeat(2)}<div class="${cls.use('progress-bar')}" data-quiz-progress-bar></div>`,
    );
    lines.push(
      `${INDENT.repeat(2)}<div class="${cls.use('progress-label')}" data-quiz-progress-label></div>`,
    );
    lines.push(`${INDENT}</div>`);
  }

  for (const step of def.steps) {
    lines.push(...renderStep(step, cls, 1));
  }

  lines.push('</div>');

  return { html: lines.join('\n'), classes: cls.list(), warnings };
}
