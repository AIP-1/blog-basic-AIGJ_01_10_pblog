# 사각

여러 회원이 블로그를 하나씩 운영하는 티스토리형 서비스입니다.

- 문서는 모두 [home-my-blog/docs](https://github.com/home-my-blog/docs) 저장소에 있어요: 요구사항 원본, 가이드, [기능 설명서](https://github.com/home-my-blog/docs/blob/main/docs/가이드/07-기능-설명서.md), [동작 원리](https://github.com/home-my-blog/docs/blob/main/docs/가이드/08-블로그-동작-원리.md) · 스펙: [`specs/001-blog-core/`](specs/001-blog-core/)
- 화면: `frontend/` (React + Vite + TypeScript)
- 서버: `backend/` (Spring Boot 3.5, Java 21, PostgreSQL 16, Redis 7)

## 로컬에서 실행

```bash
cp .env.example .env              # DB_PASSWORD 등을 채운다
docker compose up -d db redis     # MinIO까지 쓰려면: docker compose --profile minio up -d
cd backend && ./gradlew bootRun   # http://localhost:8080, Flyway가 표와 주제를 만든다
cd frontend && npm install && npm run dev   # http://localhost:5173 (/api는 8080으로 넘긴다)
```

메일은 기본값(`MYBLOG_MAIL_MODE=log`)이면 실제로 보내지 않고, 인증번호를 서버 로그에 찍습니다.
이미지는 기본으로 `backend/data/images`에 저장합니다(`MYBLOG_IMAGE_STORAGE=s3`이면 MinIO).

## 테스트

```bash
# 서버: PostgreSQL의 myblog_test DB와 Redis가 떠 있어야 한다
createdb -h localhost -U myblog myblog_test
cd backend && DB_USERNAME=myblog DB_PASSWORD=... ./gradlew test

# 화면
cd frontend && npm run lint && npm run typecheck && npm test
```

## 이번 범위에서 뺀 것

- 커뮤니티 게시판, 세션 표(`spring_session`). 로그인 세션은 DB 대신 Redis에 둡니다(서버를 다시 켜도 로그인 유지).

## 배포

`main`에 푸시되거나 PR이 합쳐지면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로 배포합니다.

1. 검사(`ci.yml`)를 먼저 돌리고, 통과하면 도커 이미지를 만듭니다(`Dockerfile`, 화면과 서버를 이미지 하나로).
2. 이미지 파일과 `deploy/deploy.sh`를 SSH로 서버의 `~/myblog-deploy`에 올립니다.
3. 서버에서 `deploy/deploy.sh`가 **무중단(블루-그린)** 으로 바꿔 끼웁니다. 8390 포트는 nginx(`myblog-proxy`)가 받고,
   뒤에서 `myblog-blue`/`myblog-green` 중 하나가 일합니다. 쉬는 쪽에 새 서버를 띄워 정상 응답을 확인한 뒤 nginx를 새 서버로 돌리고,
   옛 서버는 하던 요청을 마치고 내려갑니다. 새 서버가 안 뜨면 새 서버만 지우고 사이트는 옛 서버로 그대로 둡니다.
   로그인 세션은 Redis(Spring Session)에 있어서 배포해도 로그아웃되지 않습니다.
   새 서버가 뜨는 동안 옛 서버도 같은 DB를 쓰므로, 컬럼 삭제·이름 변경 같은 DB 변경은 두 번의 배포로 나눠 합니다.

필요한 저장소 시크릿: `SSH_ADDRESS`, `SSH_PORT`, `SSH_ID`, `SSH_PASSWORD`, `DB_ADDRESS`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_USERNAME`, `DB_PASSWORD`.
선택 저장소 변수(Variables): `NOTICE_OWNER_EMAIL` — 공지사항을 쓰는 회원의 이메일. 그 회원 블로그의 **'공지'** 다이어리에 올린 공개 글이 `/notices`(공지사항)와 메인 공지 띠에 나옵니다. 비워 두면 공지사항은 빈 화면입니다.
서버에는 docker가 설치돼 있고 SSH 계정이 docker를 쓸 수 있어야 합니다(`sudo usermod -aG docker <계정>`).
업로드한 사진은 서버의 `~/myblog-data/images`에 남습니다. 수동 배포는 Actions 탭의 deploy에서 "Run workflow"로 합니다.
