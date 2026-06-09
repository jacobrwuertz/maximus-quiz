import { expect, test } from '@playwright/test';

// Runs the built IIFE bundle against the static fixtures — the real
// drop-in <script> path a CMS would use.

test.describe('testosterone flagship flow', () => {
  test('full flow, personalization, persistence, and CTA handoff', async ({ page }) => {
    await page.goto('/fixtures/testosterone.html');

    // Intro is visible; later steps hidden.
    await expect(page.locator('[data-quiz-step="intro"]')).toBeVisible();
    await expect(page.locator('[data-quiz-step="goal"]')).toBeHidden();

    await page.click('[data-quiz-step="intro"] [data-quiz-next]');
    await expect(page.locator('[data-quiz-step="goal"]')).toBeVisible();

    // Choosing fertility surfaces the personalized interstitial step.
    await page.click('[data-quiz-answer="fertility-preservation"]');
    await page.click('[data-quiz-step="goal"] [data-quiz-next]');
    await expect(page.locator('[data-quiz-step="fertility-note"]')).toBeVisible();

    // Continue through format + concerns.
    await page.click('[data-quiz-step="fertility-note"] [data-quiz-next]');
    await page.click('[data-quiz-answer="injectable"]');
    await page.click('[data-quiz-step="format"] [data-quiz-next]');
    await page.click('[data-quiz-answer="energy"]');
    await page.click('[data-quiz-answer="focus"]');
    await page.click('[data-quiz-step="concerns"] [data-quiz-next]');

    // Result card shows the fertility-conscious message (not the TS-only one).
    const result = page.locator('[data-quiz-step="result"]');
    await expect(result.locator('[data-quiz-show-if="goal in fertility-preservation,both"]')).toBeVisible();
    await expect(result.locator('[data-quiz-show-if="goal=testosterone-support"]')).toBeHidden();

    // Answers persisted to localStorage.
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('maximus.quiz.testosterone-finder') ?? '{}'),
    );
    expect(stored.goal).toBe('fertility-preservation');
    expect(stored.concerns).toEqual(['energy', 'focus']);

    // CTA decorated with the allowlisted key only (goal), not concerns.
    const href = await page.getAttribute('[data-quiz-cta]', 'href');
    const url = new URL(href!);
    expect(url.searchParams.get('qz_goal')).toBe('fertility-preservation');
    expect(url.searchParams.has('qz_concerns')).toBe(false);

    // Cross-subdomain cookie written with the allowlisted payload.
    const cookies = await page.context().cookies();
    const mx = cookies.find((c) => c.name === 'mx_quiz');
    expect(mx).toBeTruthy();
    expect(decodeURIComponent(mx!.value)).toContain('fertility-preservation');
  });

  test('Other option reveals an input and captures custom text', async ({ page }) => {
    await page.goto('/fixtures/testosterone.html');
    await page.click('[data-quiz-step="intro"] [data-quiz-next]');
    await page.click('[data-quiz-answer="testosterone-support"]');
    await page.click('[data-quiz-step="goal"] [data-quiz-next]');

    const otherInput = page.locator('[data-quiz-answer="other"] [data-quiz-input]');
    await expect(otherInput).toBeHidden();
    await page.click('[data-quiz-answer="other"]');
    await expect(otherInput).toBeVisible();
    await otherInput.fill('sublingual');

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('maximus.quiz.testosterone-finder') ?? '{}'),
    );
    expect(stored.format).toBe('other');
    expect(stored.format_other).toBe('sublingual');
  });
});

test.describe('self-diagnosis', () => {
  test('broken fixture emits console errors and reports not ok', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/fixtures/broken.html');

    const report = await page.evaluate(() => (window as unknown as { __report: { ok: boolean; errors: number } }).__report);
    expect(report.ok).toBe(false);
    expect(report.errors).toBeGreaterThan(0);

    // The known misconfigurations are surfaced to the console.
    const joined = errors.join('\n');
    expect(joined).toContain('show-if-unknown-value');
    expect(joined).toContain('duplicate-question-key');
    expect(joined).toContain('other-missing-input');
  });
});
