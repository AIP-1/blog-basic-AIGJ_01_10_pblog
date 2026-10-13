# Contract: REST API

> **변경 (2026-10-08)**: 커뮤니티 API와 응답의 `communityPosts` 칸은 뺐다. 검색 응답은 `{ query, type, total, blogs, posts }`이다.

기본 주소 `/api`. 요청·응답은 JSON(UTF-8), 시각은 ISO 8601(`+09:00`). 괄호는 원본 요구사항 ID.

## 공통 규칙

- **인증**: 세션 쿠키 `MYBLOG_SESSION`. 🔒 표시는 로그인 필요, 🔒주인은 해당 블로그 주인만.
- **CSRF**: `GET`이 아닌 모든 요청은 `X-XSRF-TOKEN` 헤더에 `XSRF-TOKEN` 쿠키 값을 담는다 (NF-11).
- **로그인 필요 응답**: `401 UNAUTHENTICATED` → 화면은 로그인 창을 띄우고 로그인 후 원래 동작으로 돌아간다 (CF-16-1).
- **페이지 응답**: `{ "items": [...], "page": 1, "size": 10, "totalItems": 12, "totalPages": 2 }`.
  `page`가 범위를 넘으면 마지막 페이지를 돌려준다 (CF-10-4).
- **오류 응답**:

  ```json
  { "error": { "code": "VALIDATION_FAILED", "message": "제목을 입력해 주세요",
               "fields": { "title": "제목을 입력해 주세요" } } }
  ```

  `message`·`fields`의 문구는 원본 `안내 문구` 표와 같다. 남의 비공개 글·남의 자원 수정 주소는 없는 것과 같은
  `404 POST_NOT_FOUND`("존재하지 않는 글입니다")다 (CF-05-12, CF-09-4).

## 설정

| 메서드·경로 | 설명 |
|-------------|------|
| `GET /api/config` | 화면이 쓸 기본값: 글자 수, 페이지 크기, 이미지 제한, 인기 검색어 주기, 주제 목록 (NF-08), 켜진 소셜 로그인 `socialLogin: ["kakao","google"]` |
| `GET /api/csrf` | CSRF 쿠키 발급(앱 시작 시 1회) |

## 회원·인증 (상세/01)

| 메서드·경로 | 요청 | 성공 | 주요 오류 |
|-------------|------|------|-----------|
| `POST /api/auth/verifications` | `{ purpose: "signup"\|"reset", email, nickname? }` | `202` `{ expiresAt }` | `EMAIL_TAKEN`(signup, CF-14-1), `NICKNAME_TAKEN`, `RESEND_TOO_SOON`, `DAILY_LIMIT`, `MAIL_SEND_FAILED`, `SERVICE_UNAVAILABLE`(Redis) |
| `POST /api/auth/verifications/confirm` | `{ purpose, email, code }` | `200` `{ verifiedUntil }` | `CODE_MISMATCH`, `CODE_EXPIRED`, `CODE_ATTEMPTS_EXCEEDED` |
| `POST /api/auth/signup` | `{ nickname, email, password, passwordConfirm }` | `201` → 로그인 화면 (CF-01-9) | `NOT_VERIFIED`, `VERIFICATION_EXPIRED`(CF-01-20), `EMAIL_TAKEN`(CF-01-21), `VALIDATION_FAILED` |
| `POST /api/auth/login` | `{ email, password }` | `200` `{ member }` + 새 세션 (NF-12) | `LOGIN_FAILED`(같은 문구, CF-02-3), `ACCOUNT_LOCKED` `{ unlockAt }` |
| `POST /api/auth/logout` 🔒 | — | `204` (세션 삭제) | |
| `GET /api/auth/me` | — | `200` `{ member, blog, newCommentCount }` 또는 `204`(비로그인) | |
| `POST /api/auth/password-reset` | `{ email, newPassword, newPasswordConfirm }` | `200` (모든 세션 삭제, 잠금 해제, CF-25-7~9) | `NOT_VERIFIED`, `VERIFICATION_EXPIRED`, `VALIDATION_FAILED` |
| `GET /oauth2/authorization/{kakao\|google}` | — | `302` 제공자 로그인 → `/login/oauth2/code/{id}` → `302` `/`(로그인), `/social/signup`(처음), `/?social=withdrawn\|no-email\|failed` | |
| `GET /api/auth/social/pending` | — | `200` `{ provider, email, nickname }` (세션의 소셜 가입 대기 정보) | `SOCIAL_SIGNUP_NOT_FOUND`(404) |
| `POST /api/auth/social/signup` | `{ nickname }` | `201` `{ id, member }` + 새 세션 | `SOCIAL_SIGNUP_NOT_FOUND`, `NICKNAME_TAKEN`, `EMAIL_TAKEN`, `EMAIL_WITHDRAWN`, `VALIDATION_FAILED` |

- `purpose = "reset"`은 가입 여부와 관계없이 같은 `202`를 돌려준다(CF-25-3). 제한(`RESEND_TOO_SOON`, `DAILY_LIMIT`)도 똑같이 적용한다.
- 같은 요청이 처리 중이면 두 번째는 `409 DUPLICATE_SUBMIT` (CF-01-10).

## 마이페이지 (상세/02) 🔒

| 메서드·경로 | 요청 | 성공 | 주요 오류 |
|-------------|------|------|-----------|
| `GET /api/me` | — | `{ email, nickname, bio, createdAt, blogId }` | |
| `PATCH /api/me` | `{ nickname?, bio? }` | `200` | `NICKNAME_TAKEN`, `VALIDATION_FAILED` |
| `PUT /api/me/password` | `{ currentPassword, newPassword, newPasswordConfirm }` | `200` (다른 세션 삭제, CF-15-15) | `CURRENT_PASSWORD_MISMATCH`, `SAME_AS_CURRENT`, `ACCOUNT_LOCKED` |
| `DELETE /api/me` | `{ password, acknowledged: true }` | `204` (모든 세션 삭제) | `CURRENT_PASSWORD_MISMATCH`, `ACKNOWLEDGE_REQUIRED` |

## 주제·홈 (요구사항.md 3.2, 3.3)

| 메서드·경로 | 응답 |
|-------------|------|
| `GET /api/topics` | `[ { code, name, description } ]` |
| `GET /api/home` | `{ featured: [3], latestPosts: [6], blogs: [...], communityPosts: [5] }` |
| `GET /api/topics/{code}` | `{ topic, blogCount, postCount, blogs, posts: [9], communityPosts: [3] }` 또는 `404 TOPIC_NOT_FOUND` |

## 블로그·분류 (상세/03)

| 메서드·경로 | 요청 / 응답 | 비고 |
|-------------|-------------|------|
| `GET /api/blogs/{blogId}` | `{ id, name, description, topic, owner: { nickname, bio }, postCount, lastPostAt, isOwner }` | `404 BLOG_NOT_FOUND` |
| `GET /api/blogs/{blogId}/about` | `{ ownerNickname, ownerBio, about }` | 3.6 |
| `PATCH /api/blogs/{blogId}` 🔒주인 | `{ name?, description?, about?, topicCode? }` | CF-04, BM-07 |
| `GET /api/blogs/{blogId}/categories` | `[ { id, name, postCount, isDefault, colorIndex } ]` | 방문자는 공개 글만 셈 (CF-08-9) |
| `POST /api/blogs/{blogId}/categories` 🔒주인 | `{ name }` | `CATEGORY_NAME_TAKEN` |
| `PATCH /api/categories/{id}` 🔒주인 | `{ name }` | |
| `POST /api/categories/{id}/move` 🔒주인 | `{ direction: "up"\|"down" }` | CF-08-5 |
| `DELETE /api/categories/{id}` 🔒주인 | — | `CATEGORY_HAS_POSTS` `{ postCount }`, `DEFAULT_CATEGORY` |

## 글 (상세/03, 04)

| 메서드·경로 | 요청 / 응답 | 비고 |
|-------------|-------------|------|
| `GET /api/blogs/{blogId}/posts?categoryId&page` | 페이지 `{ id, category, createdAt, title, excerpt(100자), visibility }` | 주인은 비공개 포함 (CF-10-6) |
| `GET /api/posts/{id}` | `{ id, blog, topic, category, title, body, createdAt, contentUpdatedAt, visibility, coverImageUrl, tags, likeCount, likedByMe, commentCount, prev, next, otherPosts: [3], isAuthor }` | 조회수 기록 (BM-06-3). 볼 수 없으면 `404 POST_NOT_FOUND` |
| `POST /api/blogs/{blogId}/posts` 🔒주인 | `{ title, body, categoryId, visibility, tags: [], imageIds: [], coverImageId? }` | `201 { id }` (CF-05) |
| `PUT /api/posts/{id}` 🔒작성자 | 같은 모양 | 내용이 바뀐 때만 `contentUpdatedAt` 갱신 (CF-05-13) |
| `DELETE /api/posts/{id}` 🔒작성자 | — | 댓글·좋아요·태그 연결·이미지 함께 삭제 (CF-05-15) |
| `GET /api/posts/{id}/edit` 🔒작성자 | 수정 화면용 원본 | 남의 글이면 `404` |
| `GET /api/me/last-category` 🔒 | `{ categoryId }` | 글쓰기 기본 분류 (CF-05-5) |
| `GET /api/tags/{name}/posts?page` | 페이지 (공개 글만) | CF-20-3 |

## 소통·부가 (상세/05)

| 메서드·경로 | 요청 / 응답 | 비고 |
|-------------|-------------|------|
| `GET /api/posts/{id}/comments` | `[ { id, author: { nickname } \| null, body, createdAt, canDelete } ]` 오래된 순 | `author = null` → "탈퇴한 사용자" |
| `POST /api/posts/{id}/comments` 🔒 | `{ body }` | `COMMENT_TOO_SOON`(5초, CF-18-7) |
| `DELETE /api/comments/{id}` 🔒 | — | 작성자 또는 글의 블로그 주인 (CF-18-4) |
| `PUT /api/posts/{id}/like` 🔒 | — | 누름/취소 토글 `{ liked, likeCount }`. 자기 글 `OWN_POST` (CF-19) |
| `POST /api/posts/{id}/reports` 🔒 | `{ reason, detail? }` | `ALREADY_REPORTED`, `OWN_POST` (CF-21) |
| `POST /api/images` 🔒 | `multipart file` | `201 { id, url }`. `INVALID_IMAGE`(형식·5MB, CF-22-1, 2) |
| `GET /api/images/{key}` | 이미지 바이트 | 저장소에서 읽어 전달 |

## 통합 검색·인기 검색어 (상세/04, 요구사항.md 3.8)

| 메서드·경로 | 응답 | 비고 |
|-------------|------|------|
| `GET /api/search?q&type=all\|blog\|post\|community&page` | `{ query, total, blogs, posts, communityPosts }` (각 페이지) | `q` 2~50자, 아니면 `QUERY_TOO_SHORT` (CF-11-1). 검색 기록 저장 |
| `GET /api/search/trending` | `{ updatedAt, items: [ { rank, keyword, change: "UP"\|"DOWN"\|"NEW"\|"SAME", delta } ] }` | 5초마다 갱신된 값 |

## 커뮤니티 (요구사항.md 3.7)

| 메서드·경로 | 요청 / 응답 | 비고 |
|-------------|-------------|------|
| `GET /api/community/posts?topic&page` | 페이지 `{ id, topic, title, commentCount, author, createdAt, viewCount }` | |
| `GET /api/community/posts/{id}` | 상세 + 댓글 목록 | 조회 수 기록. `404 POST_NOT_FOUND` |
| `POST /api/community/posts` 🔒 | `{ topicCode, title, body }` | |
| `PUT /api/community/posts/{id}` 🔒작성자 · `DELETE` 🔒작성자 | | spec Assumptions |
| `POST /api/community/posts/{id}/comments` 🔒 | `{ body }` | |
| `DELETE /api/community/comments/{id}` 🔒작성자 | | |

## 블로그 관리 (상세/06) 🔒주인

| 메서드·경로 | 응답 | 비고 |
|-------------|------|------|
| `GET /api/manage/dashboard` | `{ views: { today, yesterday, total }, visitors: {…}, newCommentCount, daily: [30], popularPosts: [5], recentPosts: [5] }` | BM-02 |
| `GET /api/manage/posts?visibility&categoryId&page` | 페이지 `{ id, title, category, createdAt, visibility, viewCount, commentCount }` | BM-03 |
| `GET /api/manage/comments?page` | 페이지 `{ id, author, createdAt, preview(50자), post: { id, title }, isNew }` 최신순 | 호출하면 `comments_seen_at` 갱신 (BM-05-6) |
| `GET /api/manage/stats?days=7\|30` | `{ daily: [ { date, views, visitors, comments } ] }` | BM-06 |
