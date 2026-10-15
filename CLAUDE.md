# 사각 개발 규칙 (Claude Code용)

- 프로젝트 원칙: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- 테스트 전략과 AI 규칙: [`TESTING.md`](TESTING.md) — 기능을 만들거나 고치기 전에 읽고 따른다.

## 꼭 지킬 것

- 기능을 만들 때 정상 · 경계 · 예외 테스트를 먼저 정하고, 그 테스트를 통과하도록 구현한다.
- 테스트가 실패하면 구현을 고친다. 테스트를 지우거나 건너뛰거나 기대값을 바꿔 통과시키지 않는다.
- 새 코드는 SonarQube 품질 게이트(새 버그 · 취약점 0, 커버리지 80% 이상, 중복 3% 이하)를 넘어야 병합한다.
- 모든 변경은 `feature/*` → `develop` PR로. `develop` · `main`에 직접 push하지 않는다.
- 비밀 값(비밀번호, 토큰, 키)은 코드에 넣지 않는다. GitHub Secrets와 서버 환경 변수로만.

## 확인 명령

```bash
cd backend && ./gradlew test                                   # 서버 (PostgreSQL myblog_test · Redis 필요)
cd frontend && npm run lint && npm run typecheck && npm test  # 화면
cd frontend && E2E_BASE_URL=http://localhost:8080 npm run e2e # 종단 (서버를 MYBLOG_MAIL_MODE=log 로)
```
