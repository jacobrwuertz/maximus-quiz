import { expect, test } from '@playwright/test';

// Proves the WHOLE Webflow path in a real browser:
//   definition → generate-quiz.mjs → one HTML block → IIFE bundle → working quiz
//
// The fixture is the generator's raw output, pasted unedited between <body>
// tags. Nothing here is hand-tuned, so a regression in the generator fails this
// test rather than hiding behind a fixture someone fixed up by hand.

test.describe('generated Webflow block', () => {
  test('auto-advances on answer click, with no Next control to press', async ({ page }) => {
    await page.goto('/fixtures/generated-webflow.html');

    await expect(page.locator('[data-quiz-step="goal"]')).toBeVisible();
    await expect(page.locator('[data-quiz-step="age"]')).toBeHidden();

    // One click, no Next button on this step at all — the behaviour the brief
    // asked for ("each click takes you to the next question").
    await expect(page.locator('[data-quiz-step="goal"] [data-quiz-next]')).toHaveCount(0);
    await page.click('[data-quiz-answer="testosterone-support"]');

    await expect(page.locator('[data-quiz-step="age"]')).toBeVisible();
    await expect(page.locator('[data-quiz-step="goal"]')).toBeHidden();

    await page.click('[data-quiz-answer="40s"]');
    await expect(page.locator('[data-quiz-step="concerns"]')).toBeVisible();
  });

  test('marks the root while advancing, so a transition can be styled', async ({ page }) => {
    await page.goto('/fixtures/generated-webflow.html');
    const root = page.locator('[data-quiz]');

    await page.click('[data-quiz-answer="both"]');
    // The pause is deliberate; the flag exists for the duration of it.
    await expect(root).toHaveAttribute('data-quiz-advancing', 'true');
    await expect(root).not.toHaveAttribute('data-quiz-advancing', 'true');
  });

  test('a checkbox step waits for an explicit Next', async ({ page }) => {
    await page.goto('/fixtures/generated-webflow.html');

    await page.click('[data-quiz-answer="testosterone-support"]');
    await page.click('[data-quiz-answer="40s"]');
    await expect(page.locator('[data-quiz-step="concerns"]')).toBeVisible();

    // Multi-select has no natural "done" moment, so ticking one must not move on.
    await page.click('[data-quiz-answer="energy"]');
    await page.waitForTimeout(800);
    await expect(page.locator('[data-quiz-step="concerns"]')).toBeVisible();

    await page.click('[data-quiz-step="concerns"] [data-quiz-next]');
    await expect(page.locator('[data-quiz-step="result"]')).toBeVisible();
  });

  test('the Other option reveals its bound input and captures the text', async ({ page }) => {
    await page.goto('/fixtures/generated-webflow.html');

    await page.click('[data-quiz-answer="testosterone-support"]');
    await page.click('[data-quiz-answer="40s"]');

    const otherInput = page.locator('[data-quiz-other] [data-quiz-input]');
    await expect(otherInput).toBeHidden();

    await page.click('[data-quiz-answer="other"]');
    await expect(otherInput).toBeVisible();
    await otherInput.fill('Something specific');

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('maximus.quiz.testosterone-finder') ?? '{}'),
    );
    expect(stored.concerns_other).toBe('Something specific');
  });

  test('the fertility branch opens only for the fertility answer', async ({ page }) => {
    await page.goto('/fixtures/generated-webflow.html');

    await page.click('[data-quiz-answer="fertility-preservation"]');
    await page.click('[data-quiz-answer="30s"]');
    await page.click('[data-quiz-step="concerns"] [data-quiz-next]');
    await expect(page.locator('[data-quiz-step="fertility-note"]')).toBeVisible();
  });

  test('the fertility branch is skipped for a testosterone answer', async ({ page }) => {
    await page.goto('/fixtures/generated-webflow.html');

    await page.click('[data-quiz-answer="testosterone-support"]');
    await page.click('[data-quiz-answer="30s"]');
    await page.click('[data-quiz-step="concerns"] [data-quiz-next]');
    await expect(page.locator('[data-quiz-step="result"]')).toBeVisible();
    await expect(page.locator('[data-quiz-step="fertility-note"]')).toBeHidden();
  });

  test('reaches submit and fires completion once', async ({ page }) => {
    await page.goto('/fixtures/generated-webflow.html');

    await page.evaluate(() => {
      (window as unknown as { completions: number }).completions = 0;
      document.addEventListener('quiz:complete', () => {
        (window as unknown as { completions: number }).completions += 1;
      });
    });

    await page.click('[data-quiz-answer="both"]');
    await page.click('[data-quiz-answer="50-plus"]');
    await page.click('[data-quiz-answer="sleep"]');
    await page.click('[data-quiz-step="concerns"] [data-quiz-next]');
    await page.click('[data-quiz-step="result"] [data-quiz-submit]');

    const completions = await page.evaluate(
      () => (window as unknown as { completions: number }).completions,
    );
    expect(completions).toBe(1);
  });

  test('the generated markup lints clean at load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/fixtures/generated-webflow.html');
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });
});
