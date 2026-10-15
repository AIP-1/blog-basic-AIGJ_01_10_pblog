import { expect, test } from '@playwright/test';
import { logIn, signUp, unique, writePost } from './helpers';

test.describe('가입 → 로그인 → 글쓰기 (핵심 흐름 1)', () => {
  test('새 회원이 가입하고 로그인해 글을 올리면, 글 화면 · 내 블로그 · 메인 최신 글에 보인다', async ({ page }) => {
    const me = await signUp(page);
    await logIn(page, me);

    const title = `종단 첫 글 ${unique('t')}`;
    const path = await writePost(page, title, '**굵게** 쓴 본문입니다', ['종단']);

    // 글 화면: 마크다운이 그려지고, 태그와 작성자가 보인다
    await expect(page.getByRole('main').locator('strong', { hasText: '굵게' })).toBeVisible();
    await expect(page.getByRole('list', { name: '태그' })).toContainText('#종단');
    await expect(page.getByRole('link', { name: me.nickname, exact: true })).toBeVisible();

    // 내 블로그 목록에 있다
    await page.getByRole('banner').getByRole('link', { name: '내 블로그' }).click();
    await expect(page.getByRole('link', { name: new RegExp(title) }).first()).toHaveAttribute('href', path);

    // 메인 최신 글에 바로 보인다 (메인 화면 캐시는 글을 쓰면 비워진다)
    await page.goto('/');
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible();
  });

  test('비밀번호가 틀리면 로그인하지 않고 안내한다', async ({ page }) => {
    const me = await signUp(page);
    const form = page.getByRole('dialog', { name: '로그인' }).locator('form[aria-label="로그인"]');
    await form.getByLabel('비밀번호').fill('wrong123!@');
    await form.getByRole('button', { name: '로그인' }).click();
    await expect(form.getByRole('alert')).toHaveText('이메일 또는 비밀번호가 올바르지 않습니다');
    await expect(page.getByRole('banner').getByRole('button', { name: me.nickname })).toHaveCount(0);
  });

  test('로그인하지 않고 글쓰기 주소로 오면 로그인이 필요하다고 안내한다', async ({ page }) => {
    await page.goto('/write');
    await expect(page.getByRole('main')).toContainText(/로그인/);
    await expect(page.getByRole('button', { name: '올리기', exact: true })).toHaveCount(0);
  });
});
