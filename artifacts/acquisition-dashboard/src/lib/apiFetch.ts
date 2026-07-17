// ─── Centralized authenticated fetch ─────────────────────────────────────────
// All API calls must go through apiFetch so they always carry a valid
// Clerk JWT in the Authorization header, regardless of whether the caller
// is a React hook or a plain async function.

type TokenGetter = () => Promise<string | null>;

let _getToken: TokenGetter | null = null;

/** Called once from the React tree as soon as Clerk is ready. */
export function setTokenGetter(fn: TokenGetter) {
  _getToken = fn;
}

/**
 * Drop-in replacement for fetch that automatically attaches
 * `Authorization: Bearer <token>` when a Clerk session is active.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = _getToken ? await _getToken() : null;
  const authHeader: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers ?? {}),
      ...authHeader,
    },
  });
}
