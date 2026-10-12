/**
 * contracts/api.md 응답 타입.
 * api.md 가 모양을 다 적지 않은 곳은 화면이 쓰는 칸을 가정했다 — 각 타입의 주석 'ASSUMED' 참고.
 */

export type ISODateString = string;
export type Visibility = 'PUBLIC' | 'PRIVATE';

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    /** ACCOUNT_LOCKED 에서 사용 (ASSUMED: error 객체 안에 둔다) */
    unlockAt?: ISODateString;
    /** CATEGORY_HAS_POSTS 에서 사용 (ASSUMED: error 객체 안에 둔다) */
    postCount?: number;
    [extra: string]: unknown;
  };
}

/* ---------- 설정 ---------- */

/** ASSUMED: GET /api/config 의 칸 이름. 없는 칸은 화면 기본값을 쓴다. */
export interface AppConfig {
  limits: {
    nicknameMin: number;
    nicknameMax: number;
    passwordMin: number;
    passwordMax: number;
    bioMax: number;
    blogNameMax: number;
    blogDescriptionMax: number;
    blogAboutMax: number;
    postTitleMax: number;
    postBodyMax: number;
    categoryNameMax: number;
    categoryDescriptionMax: number;
    commentMax: number;
    tagsPerPost: number;
    tagMax: number;
    reportDetailMax: number;
    imageMaxBytes: number;
    imagesPerPost: number;
    searchMin: number;
    searchMax: number;
    /** 탈퇴 후 복구할 수 있는 기간(일) */
    withdrawKeepDays: number;
  };
  pageSize: number;
  trendingIntervalSeconds: number;
  /** 회원별 임시저장 최대 개수 */
  draftLimit: number;
  /** 글쓰기 중 자동 임시저장 간격(초). 0이면 끔 */
  draftAutosaveSeconds: number;
  topics: Topic[];
}

/* ---------- 회원 ---------- */

/** ASSUMED: member 객체 */
export interface Member {
  id: number;
  nickname: string;
  email: string;
}

/** ASSUMED: /api/auth/me 의 blog 객체 */
export interface MyBlogRef {
  id: number;
  name: string;
}

export interface MeResponse {
  member: Member;
  blog: MyBlogRef | null;
  newCommentCount: number;
}

export interface VerificationResponse {
  expiresAt: ISODateString;
  /** 메일 서버가 없을 때(mode=log)만 온다 */
  devCode?: string;
}

export interface VerificationConfirmResponse {
  verifiedUntil: ISODateString;
}

export interface MyProfile {
  email: string;
  nickname: string;
  bio: string;
  createdAt: ISODateString;
  blogId: number;
}

/* ---------- 주제·홈 ---------- */

export interface Topic {
  code: string;
  name: string;
  description: string;
}

/** ASSUMED: 다른 응답 안에 들어가는 주제 참조 */
export interface TopicRef {
  code: string;
  name: string;
}

export interface CategoryRef {
  id: number;
  name: string;
  /** ASSUMED: 있으면 색 점에 쓴다 */
  colorIndex?: number;
}

export interface BlogRef {
  id: number;
  name: string;
}

/** ASSUMED: 홈·주제·검색의 블로그 카드 */
export interface BlogSummary {
  id: number;
  name: string;
  description: string;
  topic: TopicRef;
  ownerNickname: string;
  postCount: number;
  lastPostAt: ISODateString | null;
}

/** ASSUMED: 홈·주제·태그·검색의 글 카드 */
export interface PostSummary {
  id: number;
  title: string;
  excerpt: string;
  createdAt: ISODateString;
  blog: BlogRef;
  category?: CategoryRef | null;
  topic?: TopicRef | null;
  coverImageUrl?: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  /** 글쓴이(블로그 주인) 닉네임 — 목록의 작은 프로필 글자 */
  authorNickname?: string;
}

/** 메인 '인기 다이어리' */
export interface PopularDiary {
  id: number;
  name: string;
  colorIndex: number;
  blog: BlogRef;
  postCount: number;
}

export type FeedSort = 'latest' | 'popular';

export interface HomeResponse {
  featured: PostSummary[];
  latestPosts: PostSummary[];
  blogs: BlogSummary[];
  /** 최근 공지 몇 개 (없으면 빈 배열) */
  notices?: PostSummary[];
  /** 최근 며칠 안에 올라온 글 인기순 (이번 주 인기 글) */
  weeklyPopular?: PostSummary[];
  /** 전체 기간 인기 글 — 추천 글 후보 */
  popularPosts?: PostSummary[];
  popularDiaries?: PopularDiary[];
}

export interface TopicPageResponse {
  topic: Topic;
  blogCount: number;
  postCount: number;
  blogs: BlogSummary[];
  posts: PostSummary[];
}

/* ---------- 블로그·분류 ---------- */

export interface BlogDetail {
  id: number;
  name: string;
  description: string;
  topic: TopicRef;
  owner: { nickname: string; bio: string };
  postCount: number;
  lastPostAt: ISODateString | null;
  isOwner: boolean;
}

export interface BlogAbout {
  ownerNickname: string;
  ownerBio: string;
  about: string;
}

/** 화면에서는 "다이어리" */
export interface Category {
  id: number;
  name: string;
  /** 다이어리 소개 */
  description: string;
  /** PRIVATE면 주인만 보고, 그 안의 글도 주인만 본다 */
  visibility: Visibility;
  postCount: number;
  isDefault: boolean;
  colorIndex: number;
}

export interface BlogTag {
  name: string;
  count: number;
}

export type BlogPostSort = 'latest' | 'popular' | 'oldest';

export interface BlogPostListItem {
  id: number;
  category: CategoryRef;
  createdAt: ISODateString;
  title: string;
  excerpt: string;
  visibility: Visibility;
  coverImageUrl?: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

/* ---------- 글 ---------- */

/** ASSUMED: prev/next/otherPosts 항목 */
export interface PostLink {
  id: number;
  title: string;
  createdAt?: ISODateString;
}

export interface PostDetail {
  id: number;
  /** ASSUMED: blog 에 description 포함(블로그 소개 카드) */
  blog: BlogRef & { description?: string; ownerNickname?: string };
  topic: TopicRef;
  category: CategoryRef;
  title: string;
  body: string;
  createdAt: ISODateString;
  contentUpdatedAt: ISODateString | null;
  visibility: Visibility;
  coverImageUrl: string | null;
  /** ASSUMED: 태그 이름 배열 */
  tags: string[];
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  /** ASSUMED: prev = 더 오래된 글, next = 더 최근 글 */
  prev: PostLink | null;
  next: PostLink | null;
  otherPosts: PostLink[];
  isAuthor: boolean;
  /** 대표글로 고정됐는지 */
  pinned?: boolean;
}

export interface UploadedImage {
  id: number;
  url: string;
}

/** ASSUMED: GET /api/posts/{id}/edit 응답 */
export interface PostEditSource {
  id: number;
  blogId: number;
  title: string;
  body: string;
  categoryId: number;
  visibility: Visibility;
  tags: string[];
  images: UploadedImage[];
  coverImageId: number | null;
}

export interface PostSaveRequest {
  title: string;
  body: string;
  categoryId: number;
  visibility: Visibility;
  tags: string[];
  imageIds: number[];
  coverImageId?: number | null;
  /** 임시저장 글을 이어 써서 올릴 때. 올리면 그 임시저장 글은 지워진다 */
  draftId?: number;
}

/* ---------- 임시저장 (CF-05) ---------- */

export interface DraftSummary {
  id: number;
  title: string;
  preview: string;
  updatedAt: ISODateString;
}

export interface DraftList {
  items: DraftSummary[];
  limit: number;
}

export interface Draft {
  id: number;
  title: string;
  body: string;
  categoryId: number | null;
  visibility: Visibility;
  tags: string[];
  images: UploadedImage[];
  coverImageId: number | null;
  updatedAt: ISODateString;
}

export interface DraftSaveRequest {
  title: string;
  body: string;
  categoryId: number | null;
  visibility: Visibility;
  tags: string[];
  imageIds: number[];
  coverImageId: number | null;
}

/* ---------- 소통 ---------- */

export interface Comment {
  id: number;
  /** null이면 원 댓글, 값이 있으면 그 원 댓글의 답글 (한 단계) */
  parentId: number | null;
  author: { nickname: string } | null;
  body: string;
  createdAt: ISODateString;
  canDelete: boolean;
  /** 원 댓글에만 있다. 오래된 순 */
  replies?: Comment[];
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

export type ReportReason = 'SPAM' | 'ABUSE' | 'ADULT' | 'OTHER';

/* ---------- 검색 ---------- */

export type SearchType = 'all' | 'blog' | 'post';

export interface SearchResponse {
  query: string;
  total: number;
  blogs: Page<BlogSummary>;
  posts: Page<PostSummary>;
}

export type TrendChange = 'UP' | 'DOWN' | 'NEW' | 'SAME';

export interface TrendingItem {
  rank: number;
  keyword: string;
  change: TrendChange;
  delta: number;
}

export interface TrendingResponse {
  updatedAt: ISODateString;
  items: TrendingItem[];
}

/* ---------- 블로그 관리 ---------- */

export interface CountTriple {
  today: number;
  yesterday: number;
  total: number;
}

/** ASSUMED: daily 항목 */
export interface DailyPoint {
  date: string;
  views: number;
  visitors: number;
  comments?: number;
}

export interface DashboardResponse {
  views: CountTriple;
  visitors: CountTriple;
  newCommentCount: number;
  daily: DailyPoint[];
  /** ASSUMED: { id, title, viewCount } */
  popularPosts: { id: number; title: string; viewCount: number }[];
  /** ASSUMED: { id, title, createdAt, visibility } */
  recentPosts: { id: number; title: string; createdAt: ISODateString; visibility: Visibility }[];
}

export interface ManagePostItem {
  id: number;
  title: string;
  category: CategoryRef;
  createdAt: ISODateString;
  visibility: Visibility;
  viewCount: number;
  commentCount: number;
}

export interface ManageCommentItem {
  id: number;
  /** ASSUMED: 글 댓글과 같은 { nickname } | null */
  author: { nickname: string } | null;
  createdAt: ISODateString;
  preview: string;
  post: { id: number; title: string };
  /** 답글이면 true */
  reply: boolean;
  isNew: boolean;
}

export interface StatsResponse {
  daily: Required<DailyPoint>[];
}
