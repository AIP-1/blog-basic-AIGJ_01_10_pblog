import { expect, test } from '@playwright/test';
import { logIn, signUp, unique, writePost } from './helpers';

test.describe('다른 회원의 글에 댓글 · 좋아요 (핵심 흐름 2)', () => {
  test('글쓴이가 올린 글에 다른 회원이 댓글을 달고 좋아요를 누르면, 글쓴이에게도 보인다', async ({ browser }) => {
    // 글쓴이
    const writerCtx = await browser.newContext();
    const writer = await writerCtx.newPage();
    const author = await signUp(writer);
    await logIn(writer, author);
    const title = `댓글 받을 글 ${unique('c')}`;
    const path = await writePost(writer, title, '댓글을 기다리는 글');

    // 다른 회원
    const readerCtx = await browser.newContext();
    const reader = await readerCtx.newPage();
    const fan = await signUp(reader);
    await logIn(reader, fan);
    await reader.goto(path);
    await expect(reader.getByRole('heading', { level: 1, name: title })).toBeVisible();

    const like = reader.getByRole('button', { name: /^좋아요/ });
    await expect(like).toBeEnabled();
    await like.click();
    await expect(like).toContainText('1');

    const comments = reader.getByRole('region', { name: '댓글' });
    await comments.getByLabel('댓글 입력').fill('잘 읽었어요!');
    await comments.getByRole('button', { name: '댓글 등록' }).click();
    await expect(comments.getByText('잘 읽었어요!')).toBeVisible();
    await expect(comments.getByRole('heading', { name: '댓글 1' })).toBeVisible();

    // 글쓴이가 새로 열어도 그대로 보인다 (서버에 저장됐다)
    await writer.goto(path);
    const writerComments = writer.getByRole('region', { name: '댓글' });
    await expect(writerComments.getByText('잘 읽었어요!')).toBeVisible();
    await expect(writerComments.getByText(fan.nickname).first()).toBeVisible();
    await expect(writer.getByRole('button', { name: /^좋아요/ })).toContainText('1');

    await writerCtx.close();
    await readerCtx.close();
  });

  test('로그인하지 않은 손님은 글을 읽을 수 있지만 좋아요는 누를 수 없다', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const me = await signUp(page);
    await logIn(page, me);
    const title = `손님이 읽을 글 ${unique('g')}`;
    const path = await writePost(page, title, '누구나 읽는 공개 글');

    const guest = await browser.newPage();
    await guest.goto(path);
    await expect(guest.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(guest.getByText('누구나 읽는 공개 글')).toBeVisible();
    await guest.getByRole('button', { name: /^좋아요/ }).click();
    await expect(guest.getByRole('dialog', { name: '로그인' })).toBeVisible();
    await ctx.close();
  });
});
