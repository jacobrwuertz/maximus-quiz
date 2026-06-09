// Answer aggregation + namespaced localStorage persistence.
//
// This store is the primary personalization source on the marketing site.
// It is resilient: if localStorage is unavailable (private mode, blocked),
// answers still live in memory for the duration of the session.

import type { Answers, AnswerValue } from './types.js';

export class AnswerStore {
  private answers: Answers = {};
  private readonly storageKey: string;

  constructor(quizId: string, storageKey?: string) {
    this.storageKey = storageKey ?? `maximus.quiz.${quizId}`;
    this.load();
  }

  private safeStorage(): Storage | null {
    try {
      const s = window.localStorage;
      const probe = '__mxq_probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch {
      return null;
    }
  }

  private load(): void {
    const s = this.safeStorage();
    if (!s) return;
    try {
      const raw = s.getItem(this.storageKey);
      if (raw) this.answers = JSON.parse(raw) as Answers;
    } catch {
      // Corrupt payload — start clean rather than throw.
      this.answers = {};
    }
  }

  private persist(): void {
    const s = this.safeStorage();
    if (!s) return;
    try {
      s.setItem(this.storageKey, JSON.stringify(this.answers));
    } catch {
      // Quota or serialization failure — keep the in-memory copy.
    }
  }

  /** Set a single-valued answer (radio / text). */
  set(key: string, value: string): void {
    this.answers[key] = value;
    this.persist();
  }

  /** Toggle a value within a multi-valued answer (checkbox). */
  toggle(key: string, value: string, on: boolean): void {
    const current = this.answers[key];
    const arr = Array.isArray(current) ? [...current] : current ? [current] : [];
    const idx = arr.indexOf(value);
    if (on && idx === -1) arr.push(value);
    if (!on && idx !== -1) arr.splice(idx, 1);
    this.answers[key] = arr;
    this.persist();
  }

  /** Remove a key entirely (e.g. clearing an Other input). */
  remove(key: string): void {
    delete this.answers[key];
    this.persist();
  }

  get(key: string): AnswerValue | undefined {
    return this.answers[key];
  }

  /** A defensive copy of all aggregated answers. */
  all(): Answers {
    return structuredClone(this.answers);
  }

  /** Wipe all answers for this quiz. */
  clear(): void {
    this.answers = {};
    const s = this.safeStorage();
    if (s) {
      try {
        s.removeItem(this.storageKey);
      } catch {
        /* ignore */
      }
    }
  }
}
