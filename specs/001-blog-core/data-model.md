# Data Model: MyBlog 1차 개발 범위 (ERD 초안)

PostgreSQL 16 기준. 모든 표의 기본 키는 `id bigint generated always as identity`이고, 시각 칸은
`timestamptz`(UTC 저장, 화면은 Asia/Seoul). Flyway 마이그레이션으로 만든다. 괄호는 원본 요구사항 ID.

표 이름은 복수형으로 바꿨다(2026-10-08, 팀 리뷰). `post_report`는 `post_flags`로 바꿨다 — "report"가
'보고서'로 읽혀서 신고는 "flag"로 부른다. 칸 이름(`post_id`, `member_id` 등)은 그대로다. V1은 손대지 않고
`V2__plural_table_names.sql`에서 표·제약·인덱스·시퀀스 이름만 바꾼다.

## 관계 한눈에 보기

```text
members 1 ── 1 blogs N ── 1 topics
   │          │
   │          ├── N categories
   │          └── N posts ── N comments (author → members, NULL 가능 / parent → comments, 답글 한 단계)
   │                 ├── N post_likes (members)
   │                 ├── N post_tags N ── 1 tags
   │                 ├── N post_flags (members)
   │                 └── N post_images

daily_stats (blogs, posts NULL 가능, date)     search_logs (keyword, time)
```

## members (회원) — CF-01, CF-02, CF-15

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| email | varchar(254) | NOT NULL. 소문자·앞뒤 공백 제거 후 저장. `UNIQUE` (CF-14-1) |
| nickname | varchar(10) | NOT NULL. 2~10자, `^[가-힣A-Za-z0-9]+$` (CF-01-3) |
| nickname_key | varchar(10) | NOT NULL, `UNIQUE`. `lower(nickname)` — 영문 대소문자 무시 중복 검사 |
| password_hash | varchar(72) | NOT NULL. BCrypt (CF-01-8) |
| bio | varchar(100) | NOT NULL DEFAULT ''. 0~100자 (CF-15-5) |
| failed_login_count | int | NOT NULL DEFAULT 0 (CF-02-5) |
| locked_until | timestamptz | NULL. 현재 시각보다 뒤면 로그인 거부 (CF-02-6) |
| created_at | timestamptz | NOT NULL. 가입일 (CF-15-3) |
| updated_at | timestamptz | NOT NULL |
| deleted_at | timestamptz | NULL. 탈퇴 신청 시각 (소프트 삭제). 부분 인덱스 `WHERE deleted_at IS NOT NULL` |
| anonymized_at | timestamptz | NULL. 보관 기간이 지나 개인정보를 지운 시각. `deleted_at`이 있어야 한다(CHECK) |

- 탈퇴(2026-10-08, 팀 리뷰 — `V4__soft_withdraw.sql`): 탈퇴하면 `deleted_at`만 찍고 모든 기기에서 로그아웃한다.
  - 보관 기간(`myblog.member.withdraw-keep`, 기본 30일)에는 블로그·글이 아무에게도 보이지 않고(`PostQueryService.ACTIVE_AUTHOR`,
    블로그 조회·목록·검색에서 `deleted_at IS NULL`), 댓글은 "탈퇴한 사용자"로 보인다. 같은 이메일로 가입할 수 없고
    (`EMAIL_WITHDRAWN`), 비밀번호 찾기 메일도 가지 않는다. 로그인하면 `ACCOUNT_WITHDRAWN`(409, `restorableUntil`)으로
    알리고, 화면이 복구할지 물은 뒤 `POST /api/auth/restore`로 복구하며 로그인한다.
  - 보관 기간이 지나면 매일 04:40(한국 시간) `WithdrawalCleaner`가 블로그·분류·글(과 그 글의 댓글·좋아요·태그·신고·통계·이미지),
    내가 누른 좋아요, 내가 올린 이미지를 지우고, 회원 줄은 남긴 채 개인정보만 바꾼다: 이메일 → `del_랜덤값@deleted.invalid`,
    닉네임 → `del랜덤값`, 비밀번호 해시 → 쓸 수 없는 값, 소개 → 빈 값, `anonymized_at` 기록. 남의 글에 단 댓글과 신고
    기록은 회원 번호로 남는다. 이메일이 바뀌므로 그 뒤에는 같은 이메일로 다시 가입할 수 있다.
  - 개인정보는 보관 기간이 끝나면 지체 없이 파기한다는 원칙에 맞춘다. 서버 로그·백업의 보관 기간은 운영에서 따로 정한다.
- 로그인 실패·비밀번호 변경/탈퇴의 현재 비밀번호 오입력 시 `failed_login_count + 1`. 5가 되면
  `locked_until = now + 10분`, 카운트 0. 로그인 성공·비밀번호 찾기 완료 시 0, `locked_until = NULL`
  (CF-02-7, CF-15-14, CF-25-9).
- 비밀번호 규칙(8~10자, 영문·숫자·특수문자 각 1개 이상, 허용 특수문자 `!@#$%^&*()_+-=`)은 원문으로만
  검사하고 저장하지 않는다 (CF-01-4).

## 세션 — CF-02-10

세션 표는 뺐다(2026-10-08). 로그인 세션은 서버 메모리에 두고, Spring Security `SessionRegistry`로 회원별
세션을 찾아 끊는다(CF-15-15, CF-25-8). 최대 비활성 7일, 쓸 때마다 쿠키 만료를 늘린다.

## topics (주제) — 요구사항.md 1장, 3.3

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| code | varchar(20) | NOT NULL `UNIQUE`. 주소에 쓰는 값 (`travel`) |
| name | varchar(20) | NOT NULL. 화면 이름 (`여행`) |
| description | varchar(100) | NOT NULL. 주제 화면의 한 줄 설명 |
| sort_order | int | NOT NULL. 메뉴 순서 |

시드: travel 여행, food 음식, hobby 취미, exercise 운동, dev 개발. 목록만 고치면 늘리거나 줄일 수 있다.

## blogs (블로그) — CF-03, CF-04, BM-05, BM-07

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| owner_id | bigint → members | NOT NULL, `UNIQUE`(1인 1블로그, CF-03-1), ON DELETE CASCADE |
| topic_id | bigint → topics | NOT NULL. 기본 `hobby` (spec Assumptions) |
| name | varchar(30) | NOT NULL. 1~30자, 앞뒤 공백 제거. 기본 "{닉네임}의 블로그" (CF-03-2, CF-04-1) |
| description | varchar(200) | NOT NULL DEFAULT ''. 0~200자 (CF-04-2) |
| about | text | NOT NULL DEFAULT ''. 소개 화면의 소개 글 (요구사항.md 3.6) |
| comments_seen_at | timestamptz | NOT NULL. 마지막으로 댓글 관리를 연 시각. 생성 시 now (BM-05-4) |
| created_at, updated_at | timestamptz | NOT NULL |

- 나중에 1인 여러 블로그로 늘릴 때는 `owner_id`의 `UNIQUE`만 없앤다 (03-코어 '구현 방식').
- 블로그 소개 화면의 "주인 이름·한 줄 소개"는 `members.nickname`, `members.bio`를 쓴다.

## categories (분류 = 화면 이름 "다이어리") — CF-07, CF-08, BM-04

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| blog_id | bigint → blogs | NOT NULL, ON DELETE CASCADE |
| name | varchar(20) | NOT NULL. 1~20자, 앞뒤 공백 제거 (CF-08-2) |
| name_key | varchar(20) | NOT NULL. `lower(name)`. `UNIQUE (blog_id, name_key)` |
| sort_order | int | NOT NULL. 추가하면 맨 아래(최댓값+1) (CF-08-3, 5) |
| is_default | boolean | NOT NULL DEFAULT false. "미분류" 하나만 true (CF-03-3, CF-08-8) |
| color_index | int | NOT NULL. 다이어리 표지 색. 정해진 8색 목록에서 순서대로 자동 배정하고, 다이어리 설정에서 바꾼다 (BM-04-3) |
| description | varchar(100) | NOT NULL DEFAULT ''. 다이어리 소개 0~100자 |
| visibility | varchar(10) | NOT NULL DEFAULT 'PUBLIC', CHECK (PUBLIC/PRIVATE). 부분 인덱스 `WHERE visibility = 'PRIVATE'` |

- `posts.category_id`의 FK를 `ON DELETE RESTRICT`로 둬서, 글이 있는 분류는 DB에서도 지울 수 없다(CF-08-6).
- `is_default = true`인 분류는 서비스에서 삭제를 거절한다. 부분 고유 인덱스
  `UNIQUE (blog_id) WHERE is_default`로 블로그당 하나만 허용한다.
- 다이어리(2026-10-08, 데모 common-demo의 다이어리 컨셉 — `V6__diaries.sql`): 표와 칸 이름은 그대로 두고 화면에서만
  "다이어리"라고 부른다. 비공개 다이어리는 주인만 보고, 그 안의 글은 글 자체가 공개여도 주인만 본다
  (`PostQueryService.OPEN_CATEGORY`가 공개 글 조건 `PUBLIC_ONLY`/`VISIBLE_TO`에 들어 있다).
- 블로그 글 목록은 다이어리·태그로 거르고 최신순·인기순·오래된 순으로 정렬한다. 인기 점수 = 조회 ×1 + 좋아요 ×5
  + 댓글 단 사람 ×3 + 책갈피 ×4(글쓴이 본인 것은 빼고, 한 사람 댓글 여러 개는 한 명).

## posts (글) — CF-05, CF-06, CF-09, CF-13

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| blog_id | bigint → blogs | NOT NULL, ON DELETE CASCADE |
| author_id | bigint → members | NOT NULL. 1인 1블로그라 블로그 주인과 같다 (CF-12) |
| category_id | bigint → categories | NOT NULL, ON DELETE RESTRICT (CF-07-1, CF-08-6) |
| title | varchar(100) | NOT NULL. 1~100자, 앞뒤 공백 제거, 공백만은 빈 값 (CF-05-3) |
| body | text | NOT NULL. 1~10,000자, 마크다운 원문 (CF-05-4, CF-06) |
| visibility | varchar(10) | NOT NULL DEFAULT 'PUBLIC'. `CHECK IN ('PUBLIC','PRIVATE')` (CF-13-2) |
| cover_image_id | bigint → post_images | NULL. 대표 사진 (요구사항.md 3.2, 3.5) |
| featured | boolean | NOT NULL DEFAULT false. 오늘의 이슈 (research §12) |
| view_count | bigint | NOT NULL DEFAULT 0. 글별 누적 조회수 (BM-06-7) |
| created_at | timestamptz | NOT NULL. 작성 시각, 바꾸지 않음 (CF-05-7) |
| content_updated_at | timestamptz | NULL. 제목·본문·분류·공개 여부가 실제로 바뀔 때만 갱신 (CF-05-13) |

인덱스:
- `(blog_id, created_at DESC, id DESC)` — 블로그 글 목록, 이전/다음 글 (CF-10-1, CF-09-2)
- `(visibility, created_at DESC)` — 홈 "새로 올라온 글", 주제 화면
- `gin (title gin_trgm_ops)`, `gin (body gin_trgm_ops)` — 검색 (CF-11)

공개 범위 규칙 (헌법 II):
- 방문자용 조회 조건은 `visibility = 'PUBLIC' OR author_id = :viewerId` 하나뿐이고 `PostQueryService`에만 있다.
- 홈·주제·검색·인기 글·태그 목록·이전/다음 글은 viewer가 있어도 공개 글만 쓴다(원본 규칙). 내 블로그 목록과
  글 관리만 본인 비공개 글을 포함한다 (CF-10-6, BM-03-1).
- 대표글(2026-10-08, 데모 개인 기능 — `V7__pinned_posts.sql`): `pinned_at timestamptz NULL`. 값이 있으면 블로그 첫 화면
  위쪽에 고정한 순서대로 보인다. 블로그마다 최대 `myblog.post.pin-limit`(3)개로, 고정할 때 블로그 줄을
  `SELECT … FOR UPDATE`로 잠그고 세서 동시에 눌러도 넘지 않는다. 부분 인덱스 `(blog_id, pinned_at) WHERE pinned_at IS NOT NULL`.
- 다이어리 편집: 내 글 여러 개를 한 번에 다른 다이어리로 옮기거나(`POST /api/blogs/{id}/posts/move`) 지운다
  (`POST /api/blogs/{id}/posts/delete`). 하나라도 내 글이 아니면 전체를 거절한다.


## tags, post_tags (태그) — CF-20

| 표.칸 | 타입 | 제약 / 규칙 |
|-------|------|-------------|
| tags.name | varchar(15) | NOT NULL. 1~15자, 공백·쉼표 불가, 앞의 `#` 제거 (CF-20-2) |
| tags.name_key | varchar(15) | NOT NULL `UNIQUE`. `lower(name)` |
| post_tags.post_id | bigint → posts | PK 일부, ON DELETE CASCADE |
| post_tags.tag_id | bigint → tags | PK 일부 |

- 글당 최대 5개(서비스 검사, CF-20-1). 같은 글에 같은 `name_key` 불가(PK가 막음).

## post_likes (좋아요) — CF-19

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| post_id | bigint → posts | ON DELETE CASCADE |
| member_id | bigint → members | ON DELETE CASCADE |
| created_at | timestamptz | NOT NULL |

`PRIMARY KEY (post_id, member_id)` (한 번만, CF-19-2). 자기 글은 서비스에서 거절 (CF-19-4).

## post_flags (신고, 이전 이름 post_report) — CF-21

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| post_id | bigint → posts | ON DELETE CASCADE |
| reporter_id | bigint → members | ON DELETE CASCADE |
| reason | varchar(20) | `CHECK IN ('SPAM','ABUSE','ADULT','OTHER')` (스팸 / 욕설·혐오 / 음란물 / 기타) |
| detail | varchar(200) | NOT NULL DEFAULT ''. 기타일 때만 0~200자 |
| created_at | timestamptz | NOT NULL |

`UNIQUE (post_id, reporter_id)` (CF-21-3). 처리 칸은 관리자 기능과 함께 나중에 더한다 (CF-21-4).

## post_images (글 이미지) — CF-22

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| post_id | bigint → posts | NULL(업로드 직후, 글 저장 전), ON DELETE CASCADE |
| uploader_id | bigint → members | NOT NULL, ON DELETE CASCADE |
| storage_key | varchar(200) | NOT NULL `UNIQUE`. `posts/{yyyy}/{MM}/{uuid}.{ext}` |
| content_type | varchar(20) | `image/jpeg` · `image/png` · `image/gif` · `image/webp` |
| size_bytes | int | 1 ~ 5,242,880 (CF-22-2) |
| created_at | timestamptz | NOT NULL |

- 글 저장 시 본문에 쓰인 이미지 id들을 그 글에 연결하고, 글당 10장을 넘으면 거절한다 (CF-22-3).
- `post_id IS NULL AND created_at < now - 24h`인 행과 파일은 스케줄러가 지운다.

## drafts (임시저장 글) — CF-05

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| member_id | bigint → members | NOT NULL, ON DELETE CASCADE |
| category_id | bigint → categories | NULL 가능, ON DELETE SET NULL. 내 블로그 분류가 아니면 비워서 저장 |
| title | varchar(100) | NOT NULL DEFAULT ''. 0~100자 |
| body | text | NOT NULL DEFAULT ''. 0~10,000자. 제목·본문 중 하나는 있어야 한다 |
| visibility | varchar(10) | NOT NULL DEFAULT 'PUBLIC', CHECK (PUBLIC/PRIVATE) |
| tags | varchar(15)[] | NOT NULL DEFAULT '{}'. 글과 같은 태그 규칙으로 정리해서 저장 |
| image_ids | bigint[] | NOT NULL DEFAULT '{}'. 본문에 넣은 사진. 24시간 고아 사진 정리에서 빼 준다 |
| cover_image_id | bigint | NULL |
| created_at / updated_at | timestamptz | NOT NULL |

인덱스: `(member_id, updated_at DESC)`(내 임시저장 목록). 회원별 최대 `myblog.draft.max-per-member`(20)개,
글쓰기 중 바뀐 게 있으면 `myblog.draft.autosave-interval`(60초)마다 자동 저장한다(`V5__drafts.sql`).
아직 올린 글이 아니라 태그·사진은 정식 표에 연결하지 않고 배열로만 들고 있다가, 글을 올릴 때
(`POST /api/blogs/{id}/posts`의 `draftId`) 정식 표에 연결하고 그 임시저장 글을 지운다.

## comments (블로그 글 댓글) — CF-18, BM-05

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| post_id | bigint → posts | NOT NULL, ON DELETE CASCADE (CF-18-6) |
| parent_id | bigint → comments | NULL = 원 댓글, 값 = 그 원 댓글의 답글. ON DELETE CASCADE(원 댓글을 지우면 답글도). 원 댓글만 가리킬 수 있다(서버에서 검사) |
| author_id | bigint → members | NULL 가능, ON DELETE SET NULL → "탈퇴한 사용자" (CF-18-6) |
| body | varchar(500) | NOT NULL. 1~500자, 공백만 불가, 줄바꿈 허용 (CF-18-2) |
| created_at | timestamptz | NOT NULL |

인덱스: `(post_id, created_at)`(글 상세, 오래된 순), `(created_at)` + posts→blogs 조인(댓글 관리, 새 댓글 수), `(parent_id)`.

답글은 한 단계만 단다(2026-10-08, 팀 리뷰 — `V3__comment_replies.sql`). 깊이가 정해져 있어 재귀 쿼리 없이
쿼리 한 번으로 화면 순서대로 읽는다: `ORDER BY COALESCE(parent_id, id), parent_id NULLS FIRST, created_at, id`
→ 원 댓글, 그 답글들, 다음 원 댓글… API는 원 댓글마다 `replies`로 묶어 준다. 더 깊은 답글이 필요해지면
경로(path) 칸이나 클로저 표로 바꾼다.
새 댓글 수 = 내 블로그 글의 댓글 중 `created_at > blogs.comments_seen_at AND author_id <> 블로그 주인`.

## daily_stats (일별 통계) — BM-02, BM-06

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| blog_id | bigint → blogs | NOT NULL, ON DELETE CASCADE |
| post_id | bigint → posts | NULL = 블로그 전체 행, ON DELETE CASCADE |
| stat_date | date | NOT NULL. 한국 시간 기준 날짜 (BM-06-6) |
| views | int | NOT NULL DEFAULT 0 |
| visitors | int | NOT NULL DEFAULT 0. 블로그 전체 행에서만 씀 |

`UNIQUE NULLS NOT DISTINCT (blog_id, post_id, stat_date)`. 조회 시 `INSERT … ON CONFLICT DO UPDATE SET views = views + 1`.
누적 숫자는 이 표의 합으로 구한다. 일별 댓글 수는 `comments.created_at`으로 센다 (BM-06-2).

## search_logs (검색 기록) — 요구사항.md 3.8

| 칸 | 타입 | 제약 / 규칙 |
|----|------|-------------|
| keyword | varchar(50) | NOT NULL. 소문자, 연속 공백은 하나로 |
| searched_at | timestamptz | NOT NULL. 인덱스 |

30일 지난 기록은 스케줄러가 지운다.

## Redis 키 (영구 데이터 아님)

| 키 | TTL | 용도 |
|----|-----|------|
| `verify:{purpose}:{email}:code` | 10분 | 인증번호 (CF-01-14) |
| `verify:{purpose}:{email}:fails` | 10분 | 틀린 횟수, 5면 code 삭제 (CF-01-17) |
| `verify:{purpose}:{email}:cooldown` | 60초 | 1분에 1번 (CF-01-16) |
| `verify:{purpose}:{email}:daily:{yyyyMMdd}` | 24시간 | 하루 5번 (CF-01-16) |
| `verify:{purpose}:{email}:verified` | 30분 | 인증됨 표시 (CF-01-20, CF-25-5) |
| `view:post:{postId}:{vid}` | 30분 | 조회수 중복 방지 (BM-06-3) |
| `visit:{blogId}:{vid}:{yyyyMMdd}` | 한국 자정까지 | 방문자 하루 1번 (BM-06-4) |
| `comment:cooldown:{memberId}` | 5초 | 댓글 연속 등록 방지 (CF-18-7) |

`purpose`는 `signup` 또는 `reset`.

## 상태 변화

```text
글 공개 범위:  PUBLIC ⇄ PRIVATE   (PRIVATE → PUBLIC은 화면에서 확인 문구, CF-13-6)

회원 로그인 잠금:
  정상 ──실패(1~4)──▶ 정상(카운트↑) ──5번째 실패──▶ 잠금(10분)
  잠금 ──10분 경과──▶ 정상(카운트 0)       정상 ──성공──▶ 정상(카운트 0)
  어떤 상태든 ──비밀번호 찾기 완료──▶ 정상(카운트 0, 잠금 해제)

이메일 인증(가입·비밀번호 찾기 공통):
  없음 ──번호 받기──▶ 번호 발송됨 ──맞게 입력──▶ 인증됨(30분)
  번호 발송됨 ──10분 경과 / 5번 틀림 / 새로 받기──▶ 없음(이전 번호 무효)
  인증됨 ──가입·변경 완료 / 30분 경과 / 이메일 변경──▶ 없음
```
