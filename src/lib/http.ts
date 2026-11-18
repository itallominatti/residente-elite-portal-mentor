/**
 * Transporte de todos os clientes da API.
 *
 * ## Modo somente leitura ("ver como")
 *
 * Enquanto um administrador vê o portal como um mentor, nenhuma escrita sai
 * daqui: `request` recusa qualquer método que não seja GET/HEAD antes de
 * tocar a rede. A tela também esconde os botões, mas esta é a trava que não
 * depende de cada tela lembrar. Com a função `acompanhamento` ligada, o servidor
 * é a trava real: a sessão de "ver como" vai no cabeçalho `X-Ver-Como` e ele
 * recusa escrita (403 `ver_como_somente_leitura`) e grava cada acesso.
 */
import { API_BASE_URL } from '@/config';
import { fetchWithAuth } from '@/lib/session';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); this.name = 'ApiError'; }
}
export class ReadOnlyError extends Error {
  constructor() { super('Somente leitura: você está vendo o portal como outro usuário.'); this.name = 'ReadOnlyError'; }
}

let somenteLeitura = false;
export function setReadOnly(v: boolean) { somenteLeitura = v; }
export function isReadOnly() { return somenteLeitura; }

/**
 * Sessão de "ver como" aberta no servidor. Com ela, TODA requisição leva o
 * cabeçalho `X-Ver-Como`: é ele que faz o servidor recusar escrita, aluno de
 * fora da carteira e sessão vencida, e gravar cada acesso na trilha.
 */
let sessaoDeVerComo: string | null = null;
export function setVerComoSessao(id: string | null) { sessaoDeVerComo = id; }
export function getVerComoSessao() { return sessaoDeVerComo; }

/** Chamado quando o servidor diz que a sessão de "ver como" acabou (venceu, foi encerrada em outra aba). */
let aoEncerrarVerComo: (() => void) | null = null;
export function aoServidorEncerrarVerComo(cb: (() => void) | null) { aoEncerrarVerComo = cb; }

export interface OpcoesDaRequisicao {
  /** Chamadas que gerenciam a própria sessão (abrir, encerrar): sem o cabeçalho e fora da trava de leitura. */
  semVerComo?: boolean;
}

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

export async function request<T>(endpoint: string, init: RequestInit = {}, opcoes: OpcoesDaRequisicao = {}): Promise<T> {
  const metodo = (init.method ?? 'GET').toUpperCase();
  if (somenteLeitura && !opcoes.semVerComo && metodo !== 'GET' && metodo !== 'HEAD') throw new ReadOnlyError();
  const headers = new Headers(init.headers as HeadersInit);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (sessaoDeVerComo && !opcoes.semVerComo) headers.set('X-Ver-Como', sessaoDeVerComo);
  const r = await fetchWithAuth(`${API_BASE_URL}${endpoint}`, { ...init, headers });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    const code = body && typeof body === 'object' && typeof (body as Record<string, unknown>).code === 'string' ? (body as { code: string }).code : undefined;
    if (r.status === 403 && code === 'ver_como_encerrado') aoEncerrarVerComo?.();
    throw new ApiError(extrairErro(body, r.status), r.status, code);
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
