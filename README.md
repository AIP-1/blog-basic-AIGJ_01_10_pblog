# 사각

여러 회원이 블로그를 하나씩 운영하는 티스토리형 서비스입니다.

- 요구사항 원본과 가이드 문서: [home-my-blog/docs](https://github.com/home-my-blog/docs) 저장소 · 스펙: [`specs/001-blog-core/`](specs/001-blog-core/)
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

- 커뮤니티 게시판, 세션 표(`spring_session`). 로그인 세션은 서버 메모리에 있어 서버를 다시 켜면 다시 로그인합니다.

## 배포

`main`에 푸시되거나 PR이 합쳐지면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로 배포합니다.

1. 검사(`ci.yml`)를 먼저 돌리고, 통과하면 도커 이미지를 만듭니다(`Dockerfile`, 화면과 서버를 이미지 하나로).
2. 이미지 파일과 `deploy/deploy.sh`를 SSH로 서버의 `~/myblog-deploy`에 올립니다.
3. 서버에서 `deploy/deploy.sh`가 이미지를 불러와 Redis와 앱 컨테이너를 띄웁니다. 앱은 **8390** 포트입니다.

필요한 저장소 시크릿: `SSH_ADDRESS`, `SSH_PORT`, `SSH_ID`, `SSH_PASSWORD`, `DB_ADDRESS`, `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_USERNAME`, `DB_PASSWORD`.
서버에는 docker가 설치돼 있고 SSH 계정이 docker를 쓸 수 있어야 합니다(`sudo usermod -aG docker <계정>`).
업로드한 사진은 서버의 `~/myblog-data/images`에 남습니다. 수동 배포는 Actions 탭의 deploy에서 "Run workflow"로 합니다.
