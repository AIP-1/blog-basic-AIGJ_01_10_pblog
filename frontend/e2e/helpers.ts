import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'abc123!@';

/** 실행마다 겹치지 않는 값 (같은 DB를 여러 번 써도 충돌하지 않게) */
export function unique(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export interface Account {
  nickname: string;
  email: string;
}

/** 회원가입 창에서 인증번호(개발용 메일 모드에서 화면에 표시됨)까지 받아 가입한다. 끝나면 로그인 창이 열려 있다. */
export async function signUp(page: Page): Promise<Account> {
  const id = unique('e');
  const account = { nickname: `종단${id.slice(-6)}`, email: `${id}@example.com` };
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: '회원가입' }).click();
  const form = page.locator('form[aria-label="회원가입"]');
  await form.getByLabel('닉네임').fill(account.nickname);
  await form.getByLabel('이메일').fill(account.email);
  await form.getByRole('button', { name: '인증번호 받기' }).click();
  const status = form.getByRole('status');
  await expect(status).toContainText('임시 인증번호');
  const code = /임시 인증번호: (\w+)/.exec((await status.textContent()) ?? '')?.[1];
  expect(code, '개발용 메일 모드(MYBLOG_MAIL_MODE=log)에서 인증번호가 화면에 나와야 한다').toBeTruthy();
  await form.getByLabel('인증번호').fill(code!);
  await form.getByRole('button', { name: '확인' }).click();
  await form.getByLabel('비밀번호', { exact: true }).fill(PASSWORD);
  await form.getByLabel('비밀번호 확인').fill(PASSWORD);
  await form.getByRole('button', { name: '가입하기' }).click();
  await expect(page.getByRole('dialog', { name: '로그인' }).getByRole('status')).toHaveText('가입이 완료되었습니다. 로그인해 주세요');
  return account;
}

/** 열려 있는 로그인 창(없으면 머리말에서 연다)으로 로그인하고, 머리말에 닉네임이 보일 때까지 기다린다. */
export async function logIn(page: Page, account: Account, password = PASSWORD): Promise<void> {
  const dialog = page.getByRole('dialog', { name: '로그인' });
  if (!(await dialog.isVisible())) {
    await page.getByRole('banner').getByRole('button', { name: '로그인' }).click();
  }
  const form = dialog.locator('form[aria-label="로그인"]');
  await form.getByLabel('이메일').fill(account.email);
  await form.getByLabel('비밀번호').fill(password);
  await form.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('banner').getByRole('button', { name: account.nickname })).toBeVisible();
}

/** 글쓰기 화면에서 글을 올리고, 글 화면으로 이동해 제목이 보일 때까지 기다린다. 글 주소를 돌려준다. */
export async function writePost(page: Page, title: string, body: string, tags: string[] = []): Promise<string> {
  await page.goto('/write');
  await page.getByLabel('제목').fill(title);
  await page.getByLabel('본문 (마크다운)').fill(body);
  for (const tag of tags) {
    await page.getByLabel(/^태그/).fill(tag);
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: '올리기', exact: true }).click();
  await page.waitForURL(/\/posts\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  return new URL(page.url()).pathname;
}
