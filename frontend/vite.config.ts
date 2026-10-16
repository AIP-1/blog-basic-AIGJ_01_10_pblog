/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 중 API 서버 주소 (기본 Spring Boot 8080). 다른 주소면 MYBLOG_API_TARGET 으로 바꾼다.
const apiTarget = process.env.MYBLOG_API_TARGET ?? 'http://localhost:8080';
// 소셜 로그인 시작(/oauth2)과 제공자가 돌려보내는 주소(/login/oauth2)도 서버로 보낸다.
// 개발 중에는 Host를 그대로 넘겨(changeOrigin: false) 돌아올 주소가 http://localhost:5173/login/oauth2/code/... 가 된다.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: false,
      },
      '/oauth2': {
        target: apiTarget,
        changeOrigin: false,
      },
      '/login/oauth2': {
        target: apiTarget,
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // 종단 테스트(e2e/*.spec.ts)는 Playwright가 따로 돌린다
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // SonarQube가 읽는 커버리지 보고서 (coverage/lcov.info). npm run test:coverage 로 만든다
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});
