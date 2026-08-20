/**
 * The one way this app talks to the server.
 *
 * Two behaviours matter here because a mistake becomes a bug in every screen:
 * an expired access token refreshes and replays invisibly, and a bearer token
 * is never sent anywhere except visapics.org.
 */
import { useAuthStore } from '../store/auth';

export const SITE_BASE = 'https://visapics.org';
export const API_BASE = `${SITE_BASE}/api/v1`;

/**
 * The account API the website has always had, at /api rather than /api/v1.
 * The vault lives there. It answers with plain objects instead of the
 * {success, data} envelope, so it is read differently — but it is the same
 * host, the same bearer token and the same silent refresh.
 */
export const ACCOUNT_API_BASE = `${SITE_BASE}/api`;

type Surface = { base: string; enveloped: boolean };
const V1: Surface = { base: API_BASE, enveloped: true };
const ACCOUNT: Surface = { base: ACCOUNT_API_BASE, enveloped: false };

/**
 * Refresh lives on the site's auth blueprint, not under /api/v1, and it is
 * jwt_required(refresh=True) — so it takes the refresh token as the bearer and
 * answers with a bare {access_token}, outside the envelope every other route
 * uses. It issues no new refresh token: the one from /auth/device lasts 30 days.
 */
export const REFRESH_URL = `${SITE_BASE}/auth/refresh`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorBody = { code?: string; message?: string; [key: string]: unknown };

type Envelope<T> = {
  success?: boolean;
  data?: T;
  /** An object from the /api/v1 handler; a plain string from the auth layer. */
  error?: ErrorBody | string;
};

function toApiError(body: Envelope<unknown> | undefined, status: number): ApiError {
  const error = body?.error;
  if (typeof error === 'string') {
    return new ApiError(error, status, `E${status}`);
  }
  return new ApiError(
    error?.message ?? `Request failed (HTTP ${status})`,
    status,
    error?.code ?? `E${status}`,
    // The whole object: a 402 from unlock carries the product catalogue here,
    // which is what lets the paywall open without a second round trip.
    error,
  );
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;

  // One refresh at a time: several screens can 401 in the same tick, and a
  // stampede would burn the refresh token and sign the user out mid-flow.
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(REFRESH_URL, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${refreshToken}` },
        });
        if (!res.ok) return false;
        const body = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          data?: { access_token?: string; refresh_token?: string };
        };
        // Bare today, enveloped if refresh ever moves under /api/v1.
        const next = body.data ?? body;
        if (!next.access_token) return false;
        useAuthStore.setState({
          accessToken: next.access_token,
          refreshToken: next.refresh_token ?? refreshToken,
        });
        await useAuthStore.getState().persist();
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retrying = false,
  surface: Surface = V1,
): Promise<T> {
  if (path.startsWith('http')) {
    throw new Error('api paths must be relative; absolute URLs are refused');
  }

  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${surface.base}${path}`, { ...init, headers });

  if (res.status === 401 && !retrying) {
    if (await refreshSession()) return request<T>(path, init, true, surface);
  }

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(`Unreadable response (HTTP ${res.status})`, res.status, 'E_PARSE');
  }

  if (!res.ok || body.success === false) {
    throw toApiError(body, res.status);
  }

  return (surface.enveloped ? body.data : body) as T;
}

/** The account API at /api — the vault, and nothing else so far. */
export const account = {
  get: <T>(path: string) => request<T>(path, {}, false, ACCOUNT),
  post: <T>(path: string, body?: unknown) =>
    request<T>(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      false,
      ACCOUNT,
    ),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }, false, ACCOUNT),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form as unknown as BodyInit }, false, ACCOUNT),
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form as unknown as BodyInit }),
};
