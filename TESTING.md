# 테스트 전략

사각에서 무엇을, 어떤 도구로, 어느 단계에서 검증하는지 정리한 문서다. 사람과 AI(Claude Code) 모두 이 기준을 따른다.
원칙의 근거는 [프로젝트 원칙 IV. 핵심 흐름은 테스트로 지킨다](.specify/memory/constitution.md)다.

> AI가 짠 코드는 그럴듯하게 틀릴 수 있다. 믿는 것은 AI가 아니라 테스트와 품질 게이트다.

## 1. 도구

| 구분 | 도구 | 위치 |
|---|---|---|
| 서버 단위 테스트 | JUnit 5, AssertJ, Mockito | `backend/src/test/**/*Test.java` |
| 서버 통합 테스트 | Spring Boot Test, MockMvc, 실제 PostgreSQL · Redis | `backend/src/test/**/*IT.java` (공용 베이스 `support/IntegrationTest`) |
| 화면 단위 · 컴포넌트 테스트 | Vitest, Testing Library, jsdom (fetch는 `src/test/utils.tsx`의 `mockFetch`로 대신) | `frontend/src/**/*.test.tsx` |
| 종단(E2E) 테스트 | Playwright (Chromium) | `frontend/e2e/*.spec.ts` |
| 커버리지 | 서버 JaCoCo(XML), 화면 v8(lcov) | `backend/build/reports/jacoco`, `frontend/coverage/lcov.info` |
| 정적 분석 | SonarQube Cloud, ESLint, TypeScript `tsc` | `sonar-project.properties`, `frontend/eslint.config.js` |

새 도구를 들이기 전에 이 표에 있는 도구로 되는지 먼저 확인하고, 바꾸면 이 문서를 함께 고친다.

## 2. 테스트 피라미드

| 층 | 수 (2026-10-16) | 무엇을 | 속도 |
|---|---|---|---|
| 단위 · 컴포넌트 | 서버 34 + 화면 297 | 입력 규칙, 계산, 컴포넌트 하나의 동작 | 빠름 (초 단위) |
| 통합 | 서버 93 | API 하나를 실제 DB · Redis까지 통과시켜 권한 · 저장 · 오류 코드 확인 | 보통 (분 단위) |
| 종단 | 7 | 브라우저로 핵심 흐름 3개를 끝까지 | 느림 |

- 단위가 가장 많고 종단이 가장 적은 삼각형을 유지한다. 종단 테스트는 **핵심 흐름만** 둔다 (아이스크림 콘 금지).
- 서버만 보면 통합이 단위보다 많다. 사각의 서버 로직은 대부분 "권한 확인 + SQL"이라 실제 DB로 확인해야 의미가 있기 때문이다. 대신 입력 규칙처럼 DB 없이 판단할 수 있는 것은 단위 테스트로 뺀다.

### 종단 테스트가 지키는 핵심 흐름

1. 가입 → 로그인 → 글쓰기 → 글 화면 · 내 블로그 · 메인에 보임 (+ 틀린 비밀번호, 비로그인 글쓰기)
2. 다른 회원의 글에 좋아요 · 댓글 → 글쓴이에게도 보임 (+ 손님은 좋아요 대신 로그인 안내)
3. 머리말 검색 → 결과 → 글로 이동 (+ 결과 없음)

## 3. 테스트 케이스 고르는 법

기능 하나마다 세 가지를 챙긴다. 버그는 경계에서 가장 많이 생긴다.

| 종류 | 뜻 | 사각의 예 |
|---|---|---|
| 정상값 | 평범한 입력 | 비밀번호 `abc123!@`, 태그 `여행` |
| 경계값 | 규칙이 갈리는 바로 그 값 | 비밀번호 7자 · 8자 · 64자 · 65자, 글 제목 100자 · 101자, 태그 15자 · 16자, 태그 6개 |
| 예외값 | 들어오면 안 되는 값 | 공백 · 쉼표가 든 태그, `a@b..c` 이메일, 남의 글 수정, 비로그인 요청, 아주 긴 입력 |

- 서버 응답은 **오류 코드와 칸별 메시지**까지 확인한다 (`$.error.code`, `$.error.fields.title`).
- 화면 테스트는 구현이 아니라 **사용자가 보는 것** 기준으로 확인한다: 보이는 문구, 버튼 활성 여부, 서버로 보낸 요청(주소 · 메서드 · 본문).
- 운영 중 새 오류를 찾으면 **그 상황을 재현하는 테스트를 먼저 추가**하고 고친다 (예: Redis 세션 쿠키 401 → "연장된 쿠키로 재요청" 테스트).

## 4. 단계별로 돌리는 테스트

| 단계 | 무엇을 | 어디서 |
|---|---|---|
| 로컬 (커밋 전) | 고친 부분의 테스트, `npm run lint` · `npm run typecheck` | 개발자 / AI |
| PR | 서버 단위 + 통합 전체, 화면 lint · 타입 검사 · 테스트 · 빌드, 커버리지 → SonarQube 품질 게이트 | GitHub Actions `ci.yml` |
| develop 병합 | PR과 같은 검사 (SonarQube 첫 화면의 develop 분석을 최신으로) | `ci.yml` (push) |
| main 병합 (배포) | `ci.yml` 전체 → 도커 이미지 → 블루-그린 배포. 새 서버가 실제 요청(`/api/topics`)에 응답해야 전환 | `deploy.yml`, `deploy/deploy.sh` |
| 종단 | 실제 서버를 띄워 `npm run e2e` | 로컬 / CI (아래 실행 방법) |

- 어느 단계든 실패하면 그 자리에서 멈춘다. `develop` · `main`은 브랜치 규칙으로 **검사 통과 없이는 병합할 수 없다** (관리자 포함).
- 테스트를 먼저 돌려 커버리지 리포트를 만든 **뒤에** SonarQube 스캐너를 돌린다. 순서가 바뀌면 커버리지가 0%로 나온다.

## 5. 품질 게이트 (SonarQube, Sonar way)

새로 바꾼 코드 기준 (Clean as You Code):

- 새 버그 0, 새 보안 취약점 0 (신뢰성 · 보안 A)
- 커버리지 80% 이상
- 중복 3% 이하
- 보안 핫스팟 100% 검토

커버리지 100%가 품질 100%는 아니다. assert 없는 테스트도 커버리지는 오른다. 숫자는 최소 기준이고, 테스트의 질은 리뷰로 지킨다.
지적이 우리 코드에 맞지 않으면(오탐) 코드를 억지로 바꾸지 않고, 이유를 적어 SonarQube에서 False positive / Accept로 처리한다.

## 6. AI와 일할 때 지키는 규칙

1. **테스트 먼저**: 기능을 시킬 때 검증 조건(정상 · 경계 · 예외)을 먼저 말하고, 그 테스트를 통과하도록 구현하게 한다. 스펙(`specs/`)의 Given-When-Then이 곧 테스트 목록이다.
2. **테스트를 고쳐서 통과시키지 않는다**: 테스트가 실패하면 구현을 고친다. 테스트를 지우거나 건너뛰거나 기대값을 바꿔 통과시키지 않는다. (테스트 자체가 틀린 경우만 예외이고, 그때는 PR에 이유를 적는다.)
3. **AI가 쓴 테스트도 리뷰한다**: assert가 없는 테스트, 구현 결과를 그대로 기대값으로 복사한 테스트, Given-When-Then 순서를 벗어난 테스트를 걸러낸다.
4. **기존 테스트는 함부로 고치지 않는다**: 새 경우는 새 테스트로 더한다.
5. **같은 기준**: AI가 쓴 코드도 같은 품질 게이트 · 커버리지 · 보안 검사를 통과해야 병합한다.
6. **불안정한 테스트는 원인을 고친다**: 가끔 실패하는 테스트에 대기 시간을 늘리거나 재시도로 덮지 않고, "무엇이 끝났는지"를 기다리도록 고친다.

## 7. 실행 방법

```bash
# 서버: PostgreSQL의 myblog_test DB와 Redis가 떠 있어야 한다
cd backend && DB_USERNAME=myblog DB_PASSWORD=... ./gradlew test        # 커버리지: build/reports/jacoco

# 화면
cd frontend && npm run lint && npm run typecheck && npm test
cd frontend && npm run test:coverage                                     # coverage/lcov.info

# 종단: 서버를 개발용 메일 모드로 띄운다 (가입 인증번호가 화면에 나온다)
MYBLOG_MAIL_MODE=log java -jar backend/build/libs/myblog-0.1.0.jar     # 화면까지 들어 있는 이미지 · jar면 8080 하나로 충분
cd frontend && npx playwright install chromium                           # 처음 한 번
cd frontend && E2E_BASE_URL=http://localhost:8080 npm run e2e           # 실패하면 test-results/ 에 스크린샷 · trace
```

- 종단 테스트는 실행할 때마다 새 회원을 만들어 쓰므로 같은 DB에서 여러 번 돌려도 서로 부딪히지 않는다. 운영 DB에서는 돌리지 않는다.
- 개발 서버(`npm run dev`, 5173)로 돌릴 때는 `E2E_BASE_URL=http://localhost:5173`.
