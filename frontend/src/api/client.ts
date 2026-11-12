import { API_URL, REQUEST_TIMEOUT_MS } from '../config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork() {
    return this.status === 0;
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.map(capitalize).join('\n');
    if (typeof m === 'string' && m) return capitalize(m);
  }
  return fallback;
}
const capitalize = (s: unknown) => {
  const str = String(s);
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const STATUS_FALLBACK: Record<number, string> = {
  400: 'The request was not valid.',
  401: 'Your session has ended. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'This record no longer exists.',
  409: 'This change conflicts with the current state of the record.',
  413: 'The file is too large.',
  422: 'This item cannot be processed in its current state.',
  428: 'Please confirm your identity to continue.',
  429: 'Too many requests. Please wait a moment and try again.',
};

export type ElevationCredentials = { password: string };

type Handlers = {
  /** Shows the step-up modal; resolves null if the admin cancels. Must call `elevate` itself. */
  requestElevation: () => Promise<boolean>;
  /** Called on 401 for authenticated requests (session expired or revoked). */
  onUnauthorized: () => void;
};

let token: string | null = null;
let handlers: Handlers = { requestElevation: async () => false, onUnauthorized: () => undefined };
let pendingElevation: Promise<boolean> | null = null;

export const setToken = (t: string | null) => {
  token = t;
};
export const getToken = () => token;
export const registerApiHandlers = (h: Partial<Handlers>) => {
  handlers = { ...handlers, ...h };
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  /** Return raw text instead of JSON (CSV export). */
  text?: boolean;
  /** Internal: prevents an elevation loop. */
  noElevation?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions['query']) {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `${API_URL}/api${path}${qs ? `?${qs}` : ''}`;
}

async function rawRequest(path: string, opts: RequestOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers: {
        Accept: opts.text ? 'text/csv, application/json' : 'application/json',
        'X-API-Version': '1',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new ApiError(0, controller.signal.aborted ? 'The server took too long to respond.' : 'Unable to reach the server. Check your connection.');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, opts);

  if (res.status === 428 && !opts.noElevation) {
    // Share one modal between concurrent requests that need elevation.
    pendingElevation ??= handlers.requestElevation().finally(() => {
      pendingElevation = null;
    });
    const ok = await pendingElevation;
    if (!ok) throw new ApiError(428, 'Identity confirmation was cancelled.');
    return request<T>(path, { ...opts, noElevation: true });
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body: unknown = opts.text && res.ok ? await res.text() : isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/platform/auth/login')) handlers.onUnauthorized();
    throw new ApiError(res.status, messageFrom(body, STATUS_FALLBACK[res.status] ?? `Request failed (${res.status}).`), body);
  }
  return body as T;
}

export const get = <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
  request<T>(path, { query, signal });
export const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body });

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
