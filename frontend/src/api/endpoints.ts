import { api } from './client';
import type {
  AppConfig,
  BlogAbout,
  BlogDetail,
  BlogPostListItem,
  BlogPostSort,
  BlogTag,
  Category,
  Comment,
  DashboardResponse,
  Draft,
  DraftList,
  DraftSaveRequest,
  FeedSort,
  HomeResponse,
  LikeResponse,
  ManageCommentItem,
  ManagePostItem,
  MeResponse,
  Member,
  MyProfile,
  Page,
  PostDetail,
  PostEditSource,
  PostSaveRequest,
  PostSummary,
  ReportReason,
  SearchResponse,
  SearchType,
  SubscribedBlog,
  StatsResponse,
  Topic,
  TopicPageResponse,
  TrendingResponse,
  UploadedImage,
  VerificationConfirmResponse,
  VerificationResponse,
  Visibility,
} from './types';

export type VerificationPurpose = 'signup' | 'reset';

/* 설정 */
export const getConfig = () => api<Partial<AppConfig>>('/api/config');

/* 회원·인증 */
export const getMe = async (): Promise<MeResponse | null> => {
  const res = await api<MeResponse | undefined>('/api/auth/me', { skipAuthEvent: true });
  return res ?? null;
};
export const requestVerification = (body: { purpose: VerificationPurpose; email: string; nickname?: string }) =>
  api<VerificationResponse>('/api/auth/verifications', { method: 'POST', body, skipAuthEvent: true });
export const confirmVerification = (body: { purpose: VerificationPurpose; email: string; code: string }) =>
  api<VerificationConfirmResponse>('/api/auth/verifications/confirm', { method: 'POST', body, skipAuthEvent: true });
export const signup = (body: { nickname: string; email: string; password: string; passwordConfirm: string }) =>
  api<void>('/api/auth/signup', { method: 'POST', body, skipAuthEvent: true });
export const login = (body: { email: string; password: string }) =>
  api<{ member: Member }>('/api/auth/login', { method: 'POST', body, skipAuthEvent: true });
/** 탈퇴 신청한 계정 복구 (보관 기간 안). 성공하면 로그인된다. */
export const restoreAccount = (body: { email: string; password: string }) =>
  api<{ member: Member }>('/api/auth/restore', { method: 'POST', body, skipAuthEvent: true });
export const logout = () => api<void>('/api/auth/logout', { method: 'POST', skipAuthEvent: true });
export const resetPassword = (body: { email: string; newPassword: string; newPasswordConfirm: string }) =>
  api<void>('/api/auth/password-reset', { method: 'POST', body, skipAuthEvent: true });

/* 마이페이지 */
export const getMyProfile = () => api<MyProfile>('/api/me');
export const updateMyProfile = (body: { nickname?: string; bio?: string }) =>
  api<void>('/api/me', { method: 'PATCH', body });
export const changePassword = (body: { currentPassword: string; newPassword: string; newPasswordConfirm: string }) =>
  api<void>('/api/me/password', { method: 'PUT', body });
export const withdraw = (body: { password: string; acknowledged: true }) =>
  api<void>('/api/me', { method: 'DELETE', body });

/* 주제·홈 */
export const getTopics = () => api<Topic[]>('/api/topics');
export const getHome = () => api<HomeResponse>('/api/home');
/** 메인 '분야별 글': 주제 코드(없으면 전체) · 최신순/인기순 */
export const getFeed = (params: { topic?: string | null; sort?: FeedSort; page?: number }) =>
  api<Page<PostSummary>>('/api/posts', {
    query: {
      topic: params.topic || undefined,
      sort: params.sort && params.sort !== 'latest' ? params.sort : undefined,
      page: params.page,
    },
  });
/** 공지사항: 공지 담당 회원 블로그의 '공지' 다이어리 공개 글 */
export const getNotices = (page: number) => api<Page<PostSummary>>('/api/notices', { query: { page } });
export const getTopicPage = (code: string) => api<TopicPageResponse>(`/api/topics/${encodeURIComponent(code)}`);

/* 블로그·분류 */
export const getBlog = (blogId: string | number) => api<BlogDetail>(`/api/blogs/${blogId}`);
export const getBlogAbout = (blogId: string | number) => api<BlogAbout>(`/api/blogs/${blogId}/about`);
export const updateBlog = (
  blogId: number,
  body: { name?: string; description?: string; about?: string; topicCode?: string },
) => api<void>(`/api/blogs/${blogId}`, { method: 'PATCH', body });
export const getCategories = (blogId: string | number) => api<Category[]>(`/api/blogs/${blogId}/categories`);
export const createCategory = (blogId: number, name: string) =>
  api<Category>(`/api/blogs/${blogId}/categories`, { method: 'POST', body: { name } });
export const renameCategory = (id: number, name: string) =>
  api<void>(`/api/categories/${id}`, { method: 'PATCH', body: { name } });
/** 다이어리 설정: 보낸 칸만 바뀐다 */
export const updateCategory = (
  id: number,
  body: { name?: string; description?: string; colorIndex?: number; visibility?: Visibility },
) => api<void>(`/api/categories/${id}`, { method: 'PATCH', body });
export const getBlogTags = (blogId: string | number) => api<BlogTag[]>(`/api/blogs/${blogId}/tags`);
export const getPinnedPosts = (blogId: string | number) => api<PostSummary[]>(`/api/blogs/${blogId}/pinned`);
export const togglePin = (postId: number) => api<{ pinned: boolean }>(`/api/posts/${postId}/pin`, { method: 'PUT' });
/** 다이어리 편집 */
export const movePosts = (blogId: number, postIds: number[], categoryId: number) =>
  api<{ moved: number }>(`/api/blogs/${blogId}/posts/move`, { method: 'POST', body: { postIds, categoryId } });
export const deletePosts = (blogId: number, postIds: number[]) =>
  api<{ deleted: number }>(`/api/blogs/${blogId}/posts/delete`, { method: 'POST', body: { postIds } });
export const moveCategory = (id: number, direction: 'up' | 'down') =>
  api<void>(`/api/categories/${id}/move`, { method: 'POST', body: { direction } });
export const deleteCategory = (id: number) => api<void>(`/api/categories/${id}`, { method: 'DELETE' });

/* 글 */
export const getBlogPosts = (
  blogId: string | number,
  params: { categoryId?: string | null; tag?: string | null; sort?: BlogPostSort; page?: number },
) =>
  api<Page<BlogPostListItem>>(`/api/blogs/${blogId}/posts`, {
    query: {
      categoryId: params.categoryId,
      tag: params.tag || undefined,
      sort: params.sort && params.sort !== 'latest' ? params.sort : undefined,
      page: params.page,
    },
  });
export const getPost = (id: string | number) => api<PostDetail>(`/api/posts/${id}`);
export const getPostForEdit = (id: string | number) => api<PostEditSource>(`/api/posts/${id}/edit`);
export const createPost = (blogId: number, body: PostSaveRequest) =>
  api<{ id: number }>(`/api/blogs/${blogId}/posts`, { method: 'POST', body });
export const updatePost = (id: number, body: PostSaveRequest) =>
  api<void>(`/api/posts/${id}`, { method: 'PUT', body });
export const deletePost = (id: number) => api<void>(`/api/posts/${id}`, { method: 'DELETE' });
export const getLastCategory = () => api<{ categoryId: number | null }>('/api/me/last-category');
export const getDrafts = () => api<DraftList>('/api/me/drafts');
export const getDraft = (id: number) => api<Draft>(`/api/me/drafts/${id}`);
export const createDraft = (body: DraftSaveRequest) =>
  api<{ id: number; updatedAt: string }>('/api/me/drafts', { method: 'POST', body });
export const updateDraft = (id: number, body: DraftSaveRequest) =>
  api<{ id: number; updatedAt: string }>(`/api/me/drafts/${id}`, { method: 'PUT', body });
export const deleteDraft = (id: number) => api<void>(`/api/me/drafts/${id}`, { method: 'DELETE' });
export const getTagPosts = (name: string, page: number) =>
  api<Page<PostSummary>>(`/api/tags/${encodeURIComponent(name)}/posts`, { query: { page } });

/* 소통 */
export const getComments = (postId: number) => api<Comment[]>(`/api/posts/${postId}/comments`);
export const createComment = (postId: number, body: string, parentId?: number) =>
  api<Comment | undefined>(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: parentId === undefined ? { body } : { body, parentId },
  });
export const deleteComment = (id: number) => api<void>(`/api/comments/${id}`, { method: 'DELETE' });
export const toggleBookmark = (postId: number) =>
  api<{ bookmarked: boolean }>(`/api/posts/${postId}/bookmark`, { method: 'PUT' });
export const getBookmarks = (page: number) => api<Page<PostSummary>>('/api/me/bookmarks', { query: { page } });
export const toggleSubscribe = (blogId: number) =>
  api<{ subscribed: boolean; subscriberCount: number }>(`/api/blogs/${blogId}/subscribe`, { method: 'PUT' });
export const getSubscriptions = () => api<SubscribedBlog[]>('/api/me/subscriptions');
export const getSubscriptionPosts = (page: number) =>
  api<Page<PostSummary>>('/api/me/subscriptions/posts', { query: { page } });
export const toggleLike = (postId: number) => api<LikeResponse>(`/api/posts/${postId}/like`, { method: 'PUT' });
export const reportPost = (postId: number, body: { reason: ReportReason; detail?: string }) =>
  api<void>(`/api/posts/${postId}/reports`, { method: 'POST', body });
export const uploadImage = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<UploadedImage>('/api/images', { method: 'POST', body: form });
};

/* 검색 */
export const search = (params: { q: string; type: SearchType; page?: number }) =>
  api<SearchResponse>('/api/search', { query: { q: params.q, type: params.type, page: params.page } });
export const getTrending = () => api<TrendingResponse>('/api/search/trending');

/* 블로그 관리 */
export const getDashboard = () => api<DashboardResponse>('/api/manage/dashboard');
export const getManagePosts = (params: { visibility?: Visibility | null; categoryId?: string | null; page?: number }) =>
  api<Page<ManagePostItem>>('/api/manage/posts', {
    query: { visibility: params.visibility, categoryId: params.categoryId, page: params.page },
  });
export const getManageComments = (page: number) =>
  api<Page<ManageCommentItem>>('/api/manage/comments', { query: { page } });
export const getStats = (days: 7 | 30) => api<StatsResponse>('/api/manage/stats', { query: { days } });
