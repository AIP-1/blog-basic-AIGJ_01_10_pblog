import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch, renderWithProviders, type MockRoute } from '../test/utils';
import { PostEditorPage } from './PostEditorPage';

const me = { member: { id: 3, nickname: '서연', email: 's@b.com' }, blog: { id: 5, name: '서연의 블로그', topicCode: 'travel' }, newCommentCount: 0 };
const cat = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: '',
  visibility: 'PUBLIC',
  postCount: 0,
  isDefault: false,
  colorIndex: 0,
  subscriberCount: 0,
  subscribedByMe: false,
  ...extra,
});
const categories = [cat(9, '미분류', { isDefault: true }), cat(10, '여행 일기'), cat(11, '비밀', { visibility: 'PRIVATE' })];
const topics = [
  { code: 'travel', name: '여행' },
  { code: 'food', name: '맛집' },
];
const base: MockRoute[] = [
  { path: '/api/config', body: {} },
  { path: '/api/topics', body: topics },
  { path: '/api/blogs/5/categories', body: categories },
  { path: '/api/me/last-category', body: { categoryId: null } },
  { path: '/api/me/drafts', body: { items: [], limit: 20 } },
];

function PostScreen() {
  const { postId } = useParams();
  return <p>글 화면 {postId}</p>;
}

function renderAt(routes: MockRoute[], path = '/write') {
  const fetchMock = mockFetch([...routes, ...base]);
  const utils = renderWithProviders(
    <Routes>
      <Route path="/write" element={<PostEditorPage />} />
      <Route path="/posts/:postId/edit" element={<PostEditorPage />} />
      <Route path="/posts/:postId" element={<PostScreen />} />
    </Routes>,
    { path },
  );
  return { fetchMock, ...utils };
}

const sent = (fetchMock: ReturnType<typeof mockFetch>, url: string, method: string) => {
  const call = fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method);
  return call ? (JSON.parse(String(call[1]?.body)) as Record<string, unknown>) : undefined;
};
const bodyBox = () => screen.getByLabelText('본문 (마크다운)');
const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;

describe('글쓰기 화면 더 (CF-05, CF-13-6, CF-20, CF-22)', () => {
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=t; path=/';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('비회원에게는 로그인이 필요하다고 안내한다', async () => {
    renderAt([{ path: '/api/auth/me', status: 204 }]);
    expect(await screen.findByText('로그인이 필요합니다')).toBeInTheDocument();
  });

  it('블로그가 없는 회원은 "존재하지 않는 블로그"를 본다', async () => {
    renderAt([{ path: '/api/auth/me', body: { ...me, blog: null } }]);
    expect(await screen.findByText('존재하지 않는 블로그입니다')).toBeInTheDocument();
  });

  it('다이어리 목록을 못 불러오면 오류 상자를 보여 준다', async () => {
    renderAt([
      { path: '/api/auth/me', body: me },
      { path: '/api/blogs/5/categories', status: 500, body: { error: { code: 'INTERNAL', message: '다이어리를 불러오지 못했습니다' } } },
    ]);
    expect(await screen.findByText('다이어리를 불러오지 못했습니다')).toBeInTheDocument();
  });

  it('없는 임시저장 글이면 "존재하지 않는 임시저장 글"을 보여 준다', async () => {
    renderAt(
      [
        { path: '/api/auth/me', body: me },
        { path: '/api/me/drafts/99', status: 404, body: { error: { code: 'DRAFT_NOT_FOUND', message: '' } } },
      ],
      '/write?draft=99',
    );
    expect(await screen.findByText('존재하지 않는 임시저장 글입니다')).toBeInTheDocument();
  });

  it('?category=ID 로 오면 그 다이어리가 골라져 있고, 블로그 주제가 기본 분야다', async () => {
    renderAt([{ path: '/api/auth/me', body: me }], '/write?category=10');
    expect(await screen.findByRole('heading', { name: /글쓰기/ })).toHaveTextContent('서연의 블로그');
    expect(screen.getByLabelText('다이어리')).toHaveValue('10');
    expect(screen.getByLabelText('분야')).toHaveValue('travel');
  });

  it('제목·본문이 비면 저장하지 않고 칸마다 안내한다', async () => {
    const { fetchMock } = renderAt([{ path: '/api/auth/me', body: me }]);
    const submit = await screen.findByRole('button', { name: '올리기' });
    fireEvent.click(submit);
    expect(await screen.findByText('제목을 입력해 주세요')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('제목 (필수)')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(screen.getByPlaceholderText('제목 (필수)'), { target: { value: '제목만' } });
    fireEvent.click(submit);
    expect(await screen.findByText('본문을 입력해 주세요')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/blogs/5/posts')).toBe(false);
  });

  it('태그를 Enter·쉼표로 붙이고, 중복·규칙 위반은 막고, Backspace·×로 뗀다. 올리면 글 화면으로 간다', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderAt([
      { path: '/api/auth/me', body: me },
      { method: 'POST', path: '/api/blogs/5/posts', status: 201, body: { id: 77 } },
    ]);
    await user.type(await screen.findByPlaceholderText('제목 (필수)'), '  가을 여행  ');
    await user.type(bodyBox(), '단풍 구경');
    expect(screen.getByText('5자 / 10,000')).toBeInTheDocument();
    expect(screen.getByText('5/100')).toBeInTheDocument();

    const tag = screen.getByPlaceholderText('#태그 입력 후 Enter (최대 5개)');
    await user.type(tag, '단풍{Enter}');
    await user.type(tag, '산행,');
    expect(screen.getByText('#단풍')).toBeInTheDocument();
    expect(screen.getByText('#산행')).toBeInTheDocument();
    await user.type(tag, '단풍{Enter}');
    expect(screen.getByText('이미 붙인 태그입니다')).toBeInTheDocument();
    await user.clear(tag);
    expect(screen.queryByText('이미 붙인 태그입니다')).toBeNull();
    await user.type(tag, '아주아주아주아주아주긴태그이름이에요{Enter}');
    expect(screen.getByText('태그는 공백과 쉼표 없이 1~15자로 입력해 주세요')).toBeInTheDocument();
    await user.clear(tag);
    await user.type(tag, '{Backspace}');
    expect(screen.queryByText('#산행')).toBeNull();
    await user.click(screen.getByRole('button', { name: '단풍 태그 지우기' }));
    expect(screen.queryByText('#단풍')).toBeNull();

    // 입력칸에 남은 태그는 올릴 때 함께 붙인다
    await user.type(tag, '가을');
    fireEvent.click(screen.getByRole('radio', { name: '비공개' }));
    expect(screen.getByRole('radio', { name: '비공개' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByLabelText('분야'), { target: { value: 'food' } });
    fireEvent.change(screen.getByLabelText('다이어리'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));

    expect(await screen.findByText('글 화면 77')).toBeInTheDocument();
    expect(sent(fetchMock, '/api/blogs/5/posts', 'POST')).toEqual({
      title: '가을 여행',
      body: '단풍 구경',
      categoryId: 11,
      topicCode: 'food',
      visibility: 'PRIVATE',
      tags: ['가을'],
      imageIds: [],
      coverImageId: null,
    });
  });

  it('태그는 5개까지, 칸을 벗어나도(blur) 붙는다', async () => {
    const user = userEvent.setup();
    renderAt([{ path: '/api/auth/me', body: me }]);
    const tag = await screen.findByPlaceholderText('#태그 입력 후 Enter (최대 5개)');
    for (const t of ['하나', '둘', '셋', '넷']) await user.type(tag, `${t}{Enter}`);
    await user.type(tag, '다섯');
    fireEvent.blur(tag);
    expect(screen.getByText('#다섯')).toBeInTheDocument();
    expect(tag).toBeDisabled();
    expect(tag).toHaveAttribute('placeholder', '');
  });

  it('비공개에서 공개로 바꿀 때는 한 번 더 묻고, 취소하면 그대로 둔다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderAt([{ path: '/api/auth/me', body: me }]);
    fireEvent.click(await screen.findByRole('radio', { name: '구독자만' }));
    expect(screen.getByRole('radio', { name: '구독자만' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '구독자만' })); // 같은 걸 다시 누르면 아무 일도 없다
    fireEvent.click(screen.getByRole('radio', { name: '공개' }));
    expect(confirm).toHaveBeenCalledWith('공개로 바꾸면 누구나 볼 수 있습니다');
    expect(screen.getByRole('radio', { name: '구독자만' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '공개' }));
    expect(screen.getByRole('radio', { name: '공개' })).toHaveAttribute('aria-checked', 'true');
  });

  it('미리보기 탭은 본문을 마크다운으로 보여 주고, 비어 있으면 안내한다', async () => {
    renderAt([{ path: '/api/auth/me', body: me }]);
    fireEvent.click(await screen.findByRole('tab', { name: '미리보기' }));
    expect(screen.getByText('미리 볼 내용이 없습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '작성' }));
    fireEvent.change(bodyBox(), { target: { value: '## 소제목' } });
    fireEvent.click(screen.getByRole('tab', { name: '미리보기' }));
    expect(screen.getByRole('heading', { level: 2, name: '소제목' })).toBeInTheDocument();
  });

  it('사진을 올리면 본문에 이름표가 들어가고, 대표 사진을 골라 함께 저장한다. 빼면 본문에서도 빠진다', async () => {
    const user = userEvent.setup();
    const { fetchMock, container } = renderAt([
      { path: '/api/auth/me', body: me },
      { method: 'POST', path: '/api/images', status: 201, body: { id: 501, url: '/uploads/a.png' } },
      { method: 'POST', path: '/api/blogs/5/posts', status: 201, body: { id: 78 } },
    ]);
    await user.type(await screen.findByPlaceholderText('제목 (필수)'), '사진 글');
    await user.upload(fileInput(container), new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(bodyBox()).toHaveValue('[📷 사진 1]\n'));
    expect(screen.getByText(/올린 사진 1\/10/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '사진 1' })).toHaveAttribute('src', '/uploads/a.png');

    const star = screen.getByRole('button', { name: '사진 1을 대표 사진으로' });
    await user.click(star);
    expect(screen.getByRole('button', { name: '사진 1 대표 사진 빼기' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByTitle('사진 1 다시 넣기'));
    await waitFor(() => expect(bodyBox()).toHaveValue('[📷 사진 1]\n[📷 사진 1]\n'));

    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('글 화면 78')).toBeInTheDocument();
    expect(sent(fetchMock, '/api/blogs/5/posts', 'POST')).toMatchObject({
      body: '![](/uploads/a.png)\n![](/uploads/a.png)\n',
      imageIds: [501],
      coverImageId: 501,
    });
  });

  it('사진 빼기를 누르면 이름표가 본문에서 빠지고 대표 사진도 풀린다', async () => {
    const user = userEvent.setup();
    const { container } = renderAt([
      { path: '/api/auth/me', body: me },
      { method: 'POST', path: '/api/images', status: 201, body: { id: 501, url: '/uploads/a.png' } },
    ]);
    await screen.findByPlaceholderText('제목 (필수)');
    await user.upload(fileInput(container), new File(['x'], 'a.png', { type: 'image/png' }));
    await user.click(await screen.findByRole('button', { name: '사진 1을 대표 사진으로' }));
    await user.click(screen.getByRole('button', { name: '사진 1 빼기' }));
    expect(bodyBox()).toHaveValue('');
    expect(screen.queryByText(/올린 사진/)).toBeNull();
  });

  it('허용하지 않는 파일과 업로드 실패는 사진 칸 아래에 알린다', async () => {
    const { container } = renderAt([
      { path: '/api/auth/me', body: me },
      { method: 'POST', path: '/api/images', status: 500, body: { error: { code: 'INTERNAL', message: '사진을 올리지 못했습니다' } } },
    ]);
    await screen.findByPlaceholderText('제목 (필수)');
    const input = fileInput(container);
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('이미지는 5MB 이하의 jpg, png, gif, webp만 올릴 수 있습니다')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByText('사진을 올리지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이미지 올리기' })).toBeEnabled();
  });

  it('서버가 칸 오류를 주면 칸 아래에, 칸이 없는 오류·404는 폼 아래에 보여 주고 입력은 남긴다', async () => {
    const { fetchMock } = renderAt([
      { path: '/api/auth/me', body: me },
      {
        method: 'POST',
        path: '/api/blogs/5/posts',
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: '입력값 오류', fields: { title: '금지어가 있습니다' } } },
      },
    ]);
    fireEvent.change(await screen.findByPlaceholderText('제목 (필수)'), { target: { value: '나쁜 제목' } });
    fireEvent.change(bodyBox(), { target: { value: '본문' } });
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('금지어가 있습니다')).toBeInTheDocument();
    expect(screen.getByDisplayValue('나쁜 제목')).toBeInTheDocument();

    fetchMock.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ error: { code: 'X', message: '알 수 없는 칸 오류', fields: { other: '?' } } }), { status: 400 }),
    );
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('알 수 없는 칸 오류')).toBeInTheDocument();

    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: '' } }), { status: 404 }));
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('존재하지 않는 글입니다')).toBeInTheDocument();

    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { code: 'INTERNAL', message: '서버 오류' } }), { status: 500 }));
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('서버 오류')).toBeInTheDocument();
  });

  it('임시저장 글 목록을 열어 보고, 확인하면 지운다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    const { fetchMock } = renderAt([
      { path: '/api/auth/me', body: me },
      {
        path: '/api/me/drafts',
        body: {
          items: [
            { id: 41, title: '쓰다 만 글', preview: '본문 조금', updatedAt: '2026-10-08T15:42:00+09:00' },
            { id: 42, title: '', preview: '', updatedAt: '2026-10-09T09:00:00+09:00' },
          ],
          limit: 20,
        },
      },
      { method: 'DELETE', path: '/api/me/drafts/41', status: 204 },
    ]);
    const open = await screen.findByRole('button', { name: /임시저장 글/ });
    await waitFor(() => expect(open).toHaveTextContent('2'));
    fireEvent.click(open);
    const dialog = screen.getByRole('dialog', { name: '임시저장 글 2/20' });
    expect(within(dialog).getByRole('link', { name: /쓰다 만 글/ })).toHaveAttribute('href', '/write?draft=41');
    expect(within(dialog).getByText('(제목 없음)')).toBeInTheDocument();
    const del = within(dialog).getAllByRole('button', { name: '삭제' })[0];
    fireEvent.click(del);
    expect(confirm).toHaveBeenCalledWith('이 임시저장 글을 삭제할까요?');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    fireEvent.click(del);
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, init]) => u === '/api/me/drafts/41' && init?.method === 'DELETE')).toBe(true));
    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('임시저장 글이 없으면 안내한다', async () => {
    renderAt([{ path: '/api/auth/me', body: me }]);
    fireEvent.click(await screen.findByRole('button', { name: /임시저장 글/ }));
    expect(await screen.findByText('임시저장한 글이 없습니다')).toBeInTheDocument();
  });

  it('불러온 임시저장 글을 다시 임시저장하면 PUT 으로 고치고, 올릴 때 draftId 를 같이 보낸다', async () => {
    const { fetchMock } = renderAt(
      [
        { path: '/api/auth/me', body: me },
        {
          path: '/api/me/drafts/41',
          body: { id: 41, title: '쓰다 만 글', body: '본문', categoryId: 10, topicCode: null, visibility: 'PUBLIC', tags: [], images: [], coverImageId: null, updatedAt: '2026-10-08T15:42:00+09:00' },
        },
        { method: 'PUT', path: '/api/me/drafts/41', body: { id: 41, updatedAt: '2026-10-08T16:05:00+09:00' } },
        { method: 'POST', path: '/api/blogs/5/posts', status: 201, body: { id: 90 } },
      ],
      '/write?draft=41',
    );
    expect(await screen.findByDisplayValue('쓰다 만 글')).toBeInTheDocument();
    expect(screen.getByLabelText('분야')).toHaveValue('travel');
    fireEvent.change(bodyBox(), { target: { value: '본문 더' } });
    fireEvent.click(screen.getByRole('button', { name: '임시저장' }));
    expect(await screen.findByText('임시저장 16:05')).toBeInTheDocument();
    expect(sent(fetchMock, '/api/me/drafts/41', 'PUT')).toMatchObject({ title: '쓰다 만 글', body: '본문 더', categoryId: 10 });

    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    expect(await screen.findByText('글 화면 90')).toBeInTheDocument();
    expect(sent(fetchMock, '/api/blogs/5/posts', 'POST')).toMatchObject({ draftId: 41 });
  });

  it('임시저장에 실패하면 서버 문구를 보여 준다', async () => {
    renderAt([
      { path: '/api/auth/me', body: me },
      { method: 'POST', path: '/api/me/drafts', status: 409, body: { error: { code: 'DRAFT_LIMIT', message: '임시저장은 20개까지입니다' } } },
    ]);
    fireEvent.change(await screen.findByPlaceholderText('제목 (필수)'), { target: { value: '제목' } });
    fireEvent.click(screen.getByRole('button', { name: '임시저장' }));
    expect(await screen.findByText('임시저장은 20개까지입니다')).toBeInTheDocument();
  });

  it('바뀐 내용이 있으면 정해진 간격마다 자동 임시저장한다', async () => {
    const { fetchMock } = renderAt([
      { path: '/api/auth/me', body: me },
      { path: '/api/config', body: { draftAutosaveSeconds: 1 } },
      { method: 'POST', path: '/api/me/drafts', status: 201, body: { id: 50, updatedAt: '2026-10-08T15:42:00+09:00' } },
    ]);
    fireEvent.change(await screen.findByPlaceholderText('제목 (필수)'), { target: { value: '자동' } });
    expect(await screen.findByText('자동 임시저장 15:42', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(sent(fetchMock, '/api/me/drafts', 'POST')).toMatchObject({ title: '자동' });
  });

  describe('글 수정', () => {
    const source = {
      id: 12,
      blogId: 5,
      title: '원래 제목',
      body: '원래 본문 ![](/uploads/c.png)',
      categoryId: 10,
      topicCode: 'food',
      visibility: 'PUBLIC',
      tags: ['맛집'],
      images: [{ id: 700, url: '/uploads/c.png' }],
      coverImageId: 700,
    };

    it('원래 내용을 채워 보여 주고, 저장하면 PUT 으로 고친 뒤 글 화면으로 간다', async () => {
      const { fetchMock } = renderAt(
        [
          { path: '/api/auth/me', body: me },
          { path: '/api/posts/12/edit', body: source },
          { method: 'PUT', path: '/api/posts/12', status: 204 },
        ],
        '/posts/12/edit',
      );
      expect(await screen.findByRole('heading', { name: /글 수정/ })).toBeInTheDocument();
      expect(screen.getByDisplayValue('원래 제목')).toBeInTheDocument();
      expect(bodyBox()).toHaveValue('원래 본문 [📷 사진 1]');
      expect(screen.getByText('#맛집')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '사진 1 대표 사진 빼기' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '임시저장' })).toBeNull();

      fireEvent.change(screen.getByDisplayValue('원래 제목'), { target: { value: '고친 제목' } });
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      expect(await screen.findByText('글 화면 12')).toBeInTheDocument();
      expect(sent(fetchMock, '/api/posts/12', 'PUT')).toMatchObject({ title: '고친 제목', categoryId: 10, imageIds: [700], coverImageId: 700 });
    });

    it('남의 글(403)이나 없는 글이면 "존재하지 않는 글"을 보여 준다', async () => {
      renderAt(
        [
          { path: '/api/auth/me', body: me },
          { path: '/api/posts/12/edit', status: 403, body: { error: { code: 'FORBIDDEN', message: '권한 없음' } } },
        ],
        '/posts/12/edit',
      );
      expect(await screen.findByText('존재하지 않는 글입니다')).toBeInTheDocument();
    });

    it('그 밖의 오류는 오류 상자로 보여 준다', async () => {
      renderAt(
        [
          { path: '/api/auth/me', body: me },
          { path: '/api/posts/12/edit', status: 500, body: { error: { code: 'INTERNAL', message: '글을 불러오지 못했습니다' } } },
        ],
        '/posts/12/edit',
      );
      expect(await screen.findByText('글을 불러오지 못했습니다')).toBeInTheDocument();
    });
  });
});
