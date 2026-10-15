import { expect, test } from '@playwright/test';
import { logIn, signUp, unique, writePost } from './helpers';

test.describe('검색 (핵심 흐름 3)', () => {
  test('머리말 검색창으로 방금 올린 글을 찾고, 결과를 눌러 글로 간다', async ({ page }) => {
    const me = await signUp(page);
    await logIn(page, me);
    const word = unique('kw');
    const title = `검색될 글 ${word}`;
    const path = await writePost(page, title, `본문에도 ${word} 가 들어 있어요`);

    await page.getByRole('searchbox', { name: '검색어' }).fill(word);
    await page.getByRole('button', { name: '검색' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${word}`));
    await expect(page.getByText(/검색 결과 1건/)).toBeVisible();

    await page.getByRole('heading', { level: 3, name: title }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  });

  test('없는 말로 찾으면 결과가 없다고 알려 준다', async ({ page }) => {
    await page.goto(`/search?q=${unique('nothing')}&type=all`);
    await expect(page.getByRole('main')).toContainText(/검색 결과 0건|결과가 없|찾지 못/);
  });
});
