/**
 * Onde os tokens ficam e como são renovados. Mesma regra do admin-hub
 * (`src/lib/session.ts` de lá): "lembre de mim" decide localStorage x
 * sessionStorage, uma renovação por vez (o back-end rotaciona o refresh) e
 * só o primeiro 401 tenta renovar.
 *
 * Limite conhecido, igual ao do hub: token em storage é legível por JS da
 * página. A mitigação aqui é a CSP servida pelo CloudFront (iac/main.tf).
 */
import { API_BASE_URL } from '@/config';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'user';
const REMEMBER_KEY = 'remember_me';
const SESSION_KEYS = [ACCESS_KEY, REFRESH_KEY, USER_KEY] as const;

export function isRemembered(): boolean {
  try { return localStorage.getItem(REMEMBER_KEY) === 'true'; } catch { return false; }
}
export function setRemembered(value: boolean): void {
  try { localStorage.setItem(REMEMBER_KEY, String(value)); } catch { /* storage bloqueado */ }
}
function activeStorage(): Storage { return isRemembered() ? localStorage : sessionStorage; }
function read(key: string): string | null {
  try { return sessionStorage.getItem(key) ?? localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try {
    activeStorage().setItem(key, value);
    (isRemembered() ? sessionStorage : localStorage).removeItem(key);
  } catch { /* storage bloqueado */ }
}
function drop(key: string): void {
  try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* idem */ }
}

export const getAccessToken = () => read(ACCESS_KEY);
export const getRefreshToken = () => read(REFRESH_KEY);
export const getStoredUser = () => read(USER_KEY);
export const setAccessToken = (t: string) => write(ACCESS_KEY, t);
export const setRefreshToken = (t: string) => write(REFRESH_KEY, t);
export const setStoredUser = (json: string) => write(USER_KEY, json);
export function clearSession(): void { SESSION_KEYS.forEach(drop); }

let refreshEmAndamento: Promise<string | null> | null = null;

async function renovar(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const r = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data?.access) return null;
    setAccessToken(data.access);
    if (data.refresh) setRefreshToken(data.refresh);
    return data.access;
  } catch {
    return null;
  }
}

/** Chamado quando a sessão acabou de verdade. O App troca por navegação. */
let aoExpirar: () => void = () => { clearSession(); window.location.replace('/entrar'); };
export function onSessionExpired(fn: () => void) { aoExpirar = fn; }

export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const comToken = (token: string | null): RequestInit => {
    const headers = new Headers(init.headers as HeadersInit);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return { ...init, headers };
  };
  let response = await fetch(url, comToken(getAccessToken()));
  if (response.status !== 401) return response;

  if (!refreshEmAndamento) refreshEmAndamento = renovar().finally(() => { refreshEmAndamento = null; });
  const novo = await refreshEmAndamento;
  if (!novo) { aoExpirar(); return response; }

  response = await fetch(url, comToken(novo));
  if (response.status === 401) aoExpirar();
  return response;
}
