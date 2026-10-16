import { defineConfig, devices } from '@playwright/test';

/**
 * 종단(E2E) 테스트: 실제 서버(Spring + DB + Redis)를 띄워 둔 채 브라우저로 핵심 흐름만 확인한다.
 * 단위 · 컴포넌트 테스트(Vitest)와 서버 통합 테스트가 대부분을 맡고, 여기서는 "사용자가 실제로 끝까지 할 수 있는지"만 본다.
 * 주소는 E2E_BASE_URL (기본 http://localhost:8080 = 화면을 함께 내보내는 서버). 서버는 MYBLOG_MAIL_MODE=log 로 띄운다(가입 인증번호가 화면에 나온다).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
