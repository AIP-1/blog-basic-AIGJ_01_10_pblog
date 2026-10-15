import { COMMON, ERROR_CODE_MESSAGES } from '../messages';
import type { ApiErrorBody } from './types';

/** 401 이 오면 window 에 이 이벤트를 보낸다. AuthProvider 가 듣고 로그인 창을 연다 (CF-16-1). */
export const UNAUTHENTICATED_EVENT = 'myblog:unauthenticated';

export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'X-XSRF-TOKEN';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  /** error 객체에 있던 나머지 값 (unlockAt, postCount 등) */
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function isNotFound(e: unknown): boolean {
  return isApiError(e) && e.status === 404;
}

/** 오류를 화면 문구로. 서버 message 를 우선하고, 없으면 코드별 문구, 그것도 없으면 일반 문구. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    return e.message || ERROR_CODE_MESSAGES[e.code] || COMMON.genericError;
  }
  return COMMON.genericError;
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

/** /api/csrf 가 JSON 으로 token 을 돌려줄 때를 대비한 보관값 (쿠키가 우선). */
let fallbackCsrfToken: string | null = null;
let csrfPromise: Promise<void> | null = null;

/** CSRF 쿠키를 새로 받는다. 앱 시작, 로그인·로그아웃 뒤에 부른다. */
export function refreshCsrf(): Promise<void> {
  csrfPromise = (async () => {
    try {
      const res = await fetch('/api/csrf', { credentials: 'include', headers: { Accept: 'application/json' } });
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text) as { token?: unknown };
          if (typeof json.token === 'string') fallbackCsrfToken = json.token;
        } catch {
          /* 본문이 JSON 이 아니어도 쿠키만 있으면 된다 */
        }
      }
    } catch {
      /* 네트워크 오류는 실제 요청에서 다시 드러난다 */
    }
  })();
  return csrfPromise;
}

export function getCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE) ?? fallbackCsrfToken;
}

async function ensureCsrf(): Promise<string | null> {
  let token = getCsrfToken();
  if (token) return token;
  await (csrfPromise ?? refreshCsrf());
  token = getCsrfToken();
  if (token) return token;
  await refreshCsrf();
  return getCsrfToken();
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON 으로 보낼 값. FormData 면 그대로 보낸다. */
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  /** true 면 401 이어도 로그인 창 이벤트를 보내지 않는다 (로그인 요청 자체 등). */
  skipAuthEvent?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  if (!qs) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${qs}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const err = (body as Partial<ApiErrorBody> | null)?.error;
  if (err && typeof err === 'object' && typeof err.code === 'string') {
    const { code, message, fields, ...rest } = err;
    return new ApiError(
      res.status,
      code,
      typeof message === 'string' && message ? message : ERROR_CODE_MESSAGES[code] ?? COMMON.genericError,
      fields && typeof fields === 'object' ? fields : {},
      rest,
    );
  }
  let fallbackCode = `HTTP_${res.status}`;
  if (res.status === 401) fallbackCode = 'UNAUTHENTICATED';
  else if (res.status === 404) fallbackCode = 'NOT_FOUND';
  return new ApiError(res.status, fallbackCode, ERROR_CODE_MESSAGES[fallbackCode] ?? COMMON.genericError);
}

function isCsrfFailure(e: ApiError): boolean {
  return e.status === 403 && (e.code.startsWith('HTTP_') || /CSRF/i.test(e.code));
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET') {
    const token = await ensureCsrf();
    if (token) headers[CSRF_HEADER] = token;
  }
  return fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body,
    credentials: 'include',
    signal: opts.signal,
  });
}

/**
 * 모든 API 호출의 입구. 쿠키 포함, GET 이 아니면 X-XSRF-TOKEN, 오류는 ApiError 로 던진다.
 * 204 와 빈 본문은 undefined 를 돌려준다.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await send(path, opts);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', COMMON.networkError);
  }

  if (!res.ok) {
    let error = await parseError(res);
    // CSRF 토큰이 바뀌었을 수 있다 (로그인 직후 등) — 한 번만 새로 받아 다시 보낸다.
    if ((opts.method ?? 'GET') !== 'GET' && isCsrfFailure(error)) {
      await refreshCsrf();
      try {
        res = await send(path, opts);
      } catch {
        throw new ApiError(0, 'NETWORK_ERROR', COMMON.networkError);
      }
      if (res.ok) return readBody<T>(res);
      error = await parseError(res);
    }
    if (error.status === 401 && !opts.skipAuthEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT, { detail: { path } }));
    }
    throw error;
  }
  return readBody<T>(res);
}

async function readBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
