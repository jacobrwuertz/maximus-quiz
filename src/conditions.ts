// Parse and evaluate `data-quiz-show-if` expressions.
//
// Supported forms (left side is always a question key):
//   goal=testosterone-support      → equals (radio/text) or contains (checkbox)
//   goal!=fertility                → not equals / not contains
//   concerns~=energy               → checkbox set contains value (explicit)
//   goal in a,b,c                  → key's value is one of the list
//
// Shared by the engine (to gate visibility) and the linter (to validate that
// referenced keys/values actually exist).

import type { Answers, AnswerValue, Condition, ConditionOp } from './types.js';

const OPERATORS: ConditionOp[] = ['!=', '~=', '=']; // checked in priority order

/**
 * Parse a raw show-if string into a Condition. Returns null if it can't be
 * parsed (the linter reports these; the engine treats unparseable as hidden).
 */
export function parseCondition(raw: string): Condition | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // `key in a,b,c` — match the whole-word ` in ` operator first.
  const inMatch = /^([^\s]+)\s+in\s+(.+)$/i.exec(trimmed);
  if (inMatch) {
    const key = inMatch[1]!.trim();
    const values = inMatch[2]!
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (!key || values.length === 0) return null;
    return { raw: trimmed, key, op: 'in', values };
  }

  for (const op of OPERATORS) {
    const idx = trimmed.indexOf(op);
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + op.length).trim();
      if (!key || !value) return null;
      return { raw: trimmed, key, op, values: [value] };
    }
  }

  return null;
}

function asArray(value: AnswerValue | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Evaluate a parsed condition against the current answers. */
export function evaluateCondition(condition: Condition, answers: Answers): boolean {
  const current = asArray(answers[condition.key]);
  const target = condition.values;

  switch (condition.op) {
    case '=':
      // equals for single values; "contains" semantics for checkbox sets.
      return current.includes(target[0]!);
    case '!=':
      return !current.includes(target[0]!);
    case '~=':
      return current.includes(target[0]!);
    case 'in':
      return current.some((v) => target.includes(v));
    default:
      return false;
  }
}

/** Convenience: parse + evaluate in one call. Unparseable → false. */
export function matches(raw: string, answers: Answers): boolean {
  const condition = parseCondition(raw);
  return condition ? evaluateCondition(condition, answers) : false;
}
