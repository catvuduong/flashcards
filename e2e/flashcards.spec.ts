import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = 'http://localhost:3001';

async function createDeckWithCards(request: APIRequestContext, name: string) {
  const deck = await (await request.post(`${API_URL}/decks`, { data: { name } })).json();
  await request.post(`${API_URL}/decks/${deck.id}/cards/bulk`, { data: { text: 'one | 1\ntwo | 2' } });
  return deck as { id: number };
}

test('dashboard shows deck cards with due and new counts', async ({ page }) => {
  await page.goto('/');
  const cards = page.getByTestId('deck-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  await expect(cards.first().getByTestId('deck-due')).toContainText('due');
  await expect(cards.first().getByTestId('deck-new')).toContainText('new');
});

test('flip, grade and watch progress advance', async ({ page, request }) => {
  const name = `UI deck ${Date.now()}`;
  const deck = await createDeckWithCards(request, name);
  try {
    await flipAndGrade(page, name, deck);
  } finally {
    await request.delete(`${API_URL}/decks/${deck.id}`);
  }
});

async function flipAndGrade(page: Page, name: string, deck: { id: number }) {
  await page.goto('/');
  await page.getByTestId('deck-card').filter({ hasText: name }).getByRole('link', { name: /Study|Review/ }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deck.id}/study$`));

  await expect(page.getByTestId('study-progress')).toContainText('0 of 2 reviewed');

  const card = page.getByTestId('flashcard');
  await expect(card.locator('.flashcard-text')).toHaveText('one');
  await card.click();
  await expect(card.locator('.flashcard-text')).toHaveText('1');

  await page.getByTestId('grade-good').click();
  await expect(page.getByTestId('study-progress')).toContainText('1 of 2 reviewed');

  // Keyboard: Space flips the second card, then key 4 grades it Easy.
  await expect(card.locator('.flashcard-text')).toHaveText('two');
  await page.keyboard.press('Space');
  await expect(card.locator('.flashcard-text')).toHaveText('2');
  await page.keyboard.press('4');

  const summary = page.getByTestId('session-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('2 cards reviewed');
}

test('stats page renders the reviews chart and retention ring', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getByTestId('stats-chart')).toBeVisible();
  await expect(page.getByTestId('retention-ring')).toBeVisible();
});
