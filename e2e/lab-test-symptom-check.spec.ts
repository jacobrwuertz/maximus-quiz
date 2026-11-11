// Drive every result band of the lab-test symptom check, plus each band
// boundary, against the exact generated block and HtmlEmbed that ship to
// Webflow (fixtures/lab-test-symptom-check.html, from scripts/build-embed.mjs).
//
// Q4 ("adjust") scores 1 for every answer, so the lowest reachable total is 1.

import { expect, test } from '@playwright/test';

const FIXTURE = '/fixtures/lab-test-symptom-check.html';
const CHECKOUT = 'https://app.maximustribe.com/labs-first';

type Persona = {
  name: string;
  answers: [string, string, string, string, string, string];
  total: number;
  band: '0-3' | '4-9' | '10+';
  label: 'Mild' | 'Moderate' | 'Strong';
  heading: string;
};

const MILD = 'Worth knowing your exact numbers.';
const MODERATE = 'Your answers are worth a closer look.';
const STRONG = 'Your answers point to getting tested.';

const personas: Persona[] = [
  { name: 'lowest possible (1)', answers: ['under-35', 'strong', 'no-preference', 'heard', 'no-change', 'no-change'], total: 1, band: '0-3', label: 'Mild', heading: MILD },
  { name: 'mild top edge (3)', answers: ['under-35', 'strong', 'yes', 'makes-sense', 'somewhat-lower', 'no-change'], total: 3, band: '0-3', label: 'Mild', heading: MILD },
  { name: 'moderate bottom edge (4)', answers: ['35-44', 'strong', 'yes', 'didnt-know', 'somewhat-lower', 'no-change'], total: 4, band: '4-9', label: 'Moderate', heading: MODERATE },
  { name: 'moderate top edge (9)', answers: ['45-54', 'lower', 'yes', 'heard', 'a-lot-lower', 'weight'], total: 9, band: '4-9', label: 'Moderate', heading: MODERATE },
  { name: 'strong bottom edge (10)', answers: ['45-54', 'lower', 'yes', 'heard', 'a-lot-lower', 'muscle'], total: 10, band: '10+', label: 'Strong', heading: STRONG },
  { name: 'highest possible (13)', answers: ['65-plus', 'drained', 'yes', 'makes-sense', 'nearly-gone', 'both'], total: 13, band: '10+', label: 'Strong', heading: STRONG },
];

const KEYS = ['age', 'energy', 'doctor', 'adjust', 'drive', 'body'];

for (const p of personas) {
  test(`band: ${p.name}`, async ({ page }) => {
    await page.goto(FIXTURE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const root = page.locator('[data-quiz="lab-test-symptom-check"]');
    const label = root.locator('[data-quiz-progress-label]');

    for (let i = 0; i < KEYS.length; i += 1) {
      await expect(label).toHaveText(`Question ${i + 1} of 6`);
      await expect(root.locator(`[data-quiz-step="${KEYS[i]}"]`)).toBeVisible();
      await root
        .locator(`[data-quiz-question="${KEYS[i]}"] [data-quiz-answer="${p.answers[i]}"]`)
        .click();
    }

    const result = root.locator('[data-quiz-step="result"]');
    await expect(result).toBeVisible();
    await expect(label).toBeHidden();
    await expect(root).toHaveAttribute('data-quiz-score', String(p.total));
    expect(await root.locator('[data-quiz-progress-bar]').evaluate((el) => el.style.width)).toBe('100%');

    // Exactly one band is visible, and it is the right one.
    const visibleBands = result.locator('[data-quiz-band]:visible');
    await expect(visibleBands).toHaveCount(1);
    await expect(visibleBands).toHaveAttribute('data-quiz-band', p.band);
    await expect(visibleBands.locator('.mx-quiz_band-heading')).toHaveText(p.heading);
    await expect(visibleBands.locator('.mx-quiz_meter-value')).toHaveText(p.label);

    // Shared result content and the single checkout button.
    await expect(result.getByText('Maximus study mean: 1160 ng/dL')).toBeVisible();
    await expect(result.getByText('Symptoms can point to a problem. Only a lab can measure it.')).toBeVisible();
    const cta = result.locator('a.mx-quiz_cta');
    await expect(cta).toHaveCount(1);
    await expect(cta).toBeVisible();
    expect((await cta.getAttribute('href'))?.split('?')[0]).toBe(CHECKOUT);
  });
}

test('escape link goes to the lab checkout', async ({ page }) => {
  await page.goto(FIXTURE);
  const link = page.locator('a.lll-lf_text-link');
  await expect(link).toHaveText('Already know treatment is right for you? See treatment options →');
  await expect(link).toHaveAttribute('href', CHECKOUT);
});

test('only the first question shows on load, with an empty bar', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const root = page.locator('[data-quiz="lab-test-symptom-check"]');
  await expect(root.locator('[data-quiz-step]:visible')).toHaveCount(1);
  await expect(root.locator('[data-quiz-step="age"]')).toBeVisible();
  await expect(root.locator('[data-quiz-band]:visible')).toHaveCount(0);
  expect(await root.locator('[data-quiz-progress-bar]').evaluate((el) => el.style.width)).toBe('0%');
});

test('a second init does not double-advance', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // The embed marks the root once it wires the engine. The shipped embed loads the
  // engine asynchronously, so wait for the mark instead of reading it once.
  const root = page.locator('[data-quiz="lab-test-symptom-check"]');
  await expect(root).toHaveAttribute('data-quiz-init', '');
  await root.locator('[data-quiz-answer="under-35"]').click();
  await expect(root.locator('[data-quiz-step="energy"]')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(root.locator('[data-quiz-step="energy"]')).toBeVisible();
});
