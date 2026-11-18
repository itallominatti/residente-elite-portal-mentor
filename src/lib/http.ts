/**
 * Transporte de todos os clientes da API.
 *
 * ## Modo somente leitura ("ver como")
 *
 * Enquanto um administrador vê o portal como um mentor, nenhuma escrita sai
 * daqui: `request` recusa qualquer método que não seja GET/HEAD antes de
 * tocar a rede. A tela também esconde os botões, mas esta é a trava que não
 * depende de cada tela lembrar. O servidor ainda não tem uma sessão "ver
 * como" própria (docs/BACKEND.md); quando tiver, ele passa a ser a trava real.
 */
import { API_BASE_URL } from '@/config';
import { fetchWithAuth } from '@/lib/session';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}
export class ReadOnlyError extends Error {
  constructor() { super('Somente leitura: você está vendo o portal como outro usuário.'); this.name = 'ReadOnlyError'; }
}

let somenteLeitura = false;
export function setReadOnly(v: boolean) { somenteLeitura = v; }
export function isReadOnly() { return somenteLeitura; }

/** As views de mentoria devolvem `{error}`; o DRF puro, `{detail}` ou erros por campo. */
export function extrairErro(body: unknown, status: number): string {
  if (!body || typeof body !== 'object') return `Erro ${status}`;
  const o = body as Record<string, unknown>;
  for (const k of ['error', 'detail', 'message']) if (typeof o[k] === 'string' && (o[k] as string).trim()) return o[k] as string;
  const primeiro = Object.entries(o)[0];
  if (primeiro) {
    const [campo, valor] = primeiro;
    const msg = Array.isArray(valor) ? valor[0] : valor;
    if (typeof msg === 'string') return campo === 'non_field_errors' ? msg : `${campo}: ${msg}`;
  }
  return `Erro ${status}`;
}

export function qs(params: Record<string, unknown>): string {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') s.append(k, String(v)); });
  const t = s.toString();
  return t ? `?${t}` : '';
}

export async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (somenteLeitura && metodo !== 'GET' && metodo !== 'HEAD') throw new ReadOnlyError();
  const headers = new Headers(init.headers as HeadersInit);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const r = await fetchWithAuth(`${API_BASE_URL}${endpoint}`, { ...init, headers });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new ApiError(extrairErro(body, r.status), r.status);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

/** Percorre uma listagem paginada até o fim (com teto, para não laçar). */
export async function todasAsPaginas<T>(buscar: (pagina: number) => Promise<{ itens: T[]; temProxima: boolean }>, teto = 20): Promise<T[]> {
  const out: T[] = [];
  for (let p = 1; p <= teto; p++) {
    const { itens, temProxima } = await buscar(p);
    out.push(...itens);
    if (!temProxima) break;
  }
  return out;
}
