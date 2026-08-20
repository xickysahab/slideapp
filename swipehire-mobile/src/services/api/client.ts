import { API_BASE_URL } from './config';

/**
 * The single HTTP client. Every request to the API goes through here.
 *
 * Two jobs beyond fetch: attach the access token, and transparently recover from a 401 by
 * refreshing once. Access tokens last fifteen minutes, so a session that outlives one — which is
 * most of them — would otherwise start failing mid-use.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Validation failures arrive as an array, one entry per broken rule. */
    readonly details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the server rejected the request rather than failing to process it. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

/** Thrown when the device can't reach the API at all — distinct from the API saying no. */
export class NetworkError extends Error {
  constructor() {
    super("Couldn't reach the server");
    this.name = 'NetworkError';
  }
}

type TokenProvider = () => string | null;
type RefreshHandler = () => Promise<string | null>;

let getAccessToken: TokenProvider = () => null;
let refreshTokens: RefreshHandler = async () => null;

/**
 * Wires the client to the auth store.
 *
 * Injected rather than imported to keep the dependency pointing one way: the store imports the
 * client (to call /auth/refresh), so the client importing the store back would be a cycle.
 */
export function configureApiAuth(provider: TokenProvider, refresh: RefreshHandler): void {
  getAccessToken = provider;
  refreshTokens = refresh;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Set false for the auth endpoints, which must not try to refresh on their own 401. */
  authenticated?: boolean;
  signal?: AbortSignal;
}

async function rawRequest<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    // fetch only rejects on transport failure; an HTTP error is a resolved promise.
    throw new NetworkError();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;

  if (response.ok) return payload as T;

  const raw = payload?.message;
  const details = Array.isArray(raw) ? (raw as string[]) : undefined;
  const message = details?.[0] ?? (typeof raw === 'string' ? raw : 'Something went wrong');

  throw new ApiError(response.status, message, details);
}

/**
 * Makes a request, refreshing the access token once if the first attempt is rejected as expired.
 *
 * Only one retry, and only on 401. A second failure means the session is genuinely over, and
 * looping would just delay telling the user that.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authenticated = options.authenticated ?? true;
  const token = authenticated ? getAccessToken() : null;

  try {
    return await rawRequest<T>(path, options, token);
  } catch (err) {
    const isExpired = err instanceof ApiError && err.status === 401 && authenticated;
    if (!isExpired) throw err;

    const fresh = await refreshTokens();
    if (!fresh) throw err;

    return rawRequest<T>(path, options, fresh);
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
