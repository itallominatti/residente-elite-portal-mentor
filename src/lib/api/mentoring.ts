/**
 * Mentoria: árvore, carteira, radar e meta semanal.
 * Espelha `internal/handler/http/mentoring/urls.py` do elite-med-back-end.
 * O escopo é do servidor (`alunos_de`): mentor recebe os seus, submentor os
 * do mentor pai, admin todos.
 */
import { qs, request, todasAsPaginas } from '@/lib/http';

// ---------- árvore ----------
export interface Submentor { id: string; full_name: string; email: string }
export interface MentorDaArvore {
  id: string; full_name: string; email: string;
  role?: string; is_mentor?: boolean; alunos_count: number; submentores: Submentor[];
}
export const getArvore = () => request<{ mentors: MentorDaArvore[] }>('/mentoring/tree/');

// ---------- carteira ----------
export interface Vinculo { mentorship_id: string; mentor_id: string; mentor_name: string }
export interface AlunoDaCarteira { id: string; full_name: string; email: string; mentorships: Vinculo[] }
interface Paginado<T> { data: T[]; meta: { has_next: boolean; page: number; total_pages: number; count: number } }

export const getCarteira = () => todasAsPaginas<AlunoDaCarteira>(async p => {
  const r = await request<Paginado<AlunoDaCarteira>>(`/mentoring/students/${qs({ page: p, page_size: 100 })}`);
  return { itens: r.data ?? [], temProxima: !!r.meta?.has_next };
});

// ---------- radar ----------
export type CodigoDoMotivo = 'sem_questoes_7d' | 'meta_baixa_2_semanas' | 'revisoes_atrasadas' | 'queda_de_acerto' | 'simulado_abandonado';
export interface Motivo { codigo: CodigoDoMotivo | string; texto: string }
export interface AlunoNoRadar {
  id: string; nome: string; email: string; motivos: Motivo[]; resumo: string[]; rascunho: string;
  conversa_id: string | null; ultima_mensagem_do_ramo_em: string | null; pode_escrever: boolean;
}
export interface Radar { geradoEm: string | null; totalNoEscopo: number; totalEmRisco: number; alunos: AlunoNoRadar[] }

interface PaginaDoRadar { gerado_em?: string; total_no_escopo?: number; total_em_risco?: number; pagina?: number; total_de_paginas?: number; results?: AlunoNoRadar[] }

const normalizarAluno = (a: AlunoNoRadar): AlunoNoRadar => ({
  id: a.id, nome: a.nome ?? '', email: a.email ?? '',
  motivos: Array.isArray(a.motivos) ? a.motivos : [], resumo: Array.isArray(a.resumo) ? a.resumo : [],
  rascunho: a.rascunho ?? '', conversa_id: a.conversa_id ?? null,
  ultima_mensagem_do_ramo_em: a.ultima_mensagem_do_ramo_em ?? null,
  pode_escrever: a.pode_escrever === true, // fail-closed, como no hub
});

/** O radar inteiro (o servidor pagina de 50 em 50 e corrige a página pedida). */
export async function getRadar(): Promise<Radar> {
  let meta: PaginaDoRadar = {};
  const alunos = await todasAsPaginas<AlunoNoRadar>(async p => {
    const r = await request<PaginaDoRadar>(`/mentoring/radar/${qs({ page: p })}`);
    if (p === 1) meta = r;
    const pagina = r.pagina ?? p, total = r.total_de_paginas ?? 1;
    return { itens: (r.results ?? []).map(normalizarAluno), temProxima: pagina < total && pagina === p };
  });
  return { geradoEm: meta.gerado_em ?? null, totalNoEscopo: meta.total_no_escopo ?? 0, totalEmRisco: meta.total_em_risco ?? alunos.length, alunos };
}

// ---------- meta semanal ----------
export interface MetaSemanal { weekly_questions: number; weekly_hours: number | null; set_by_name: string | null; updated_at: string | null }
export interface RespostaDaMeta { goal: MetaSemanal | null; min: number; max: number; min_hours: number; max_hours: number }
export const getMeta = (alunoId: string) => request<RespostaDaMeta>(`/mentoring/students/${alunoId}/goal/`);
/** `weekly_hours` vai sempre, mesmo nulo: o servidor grava os dois campos a cada PUT. */
export const salvarMeta = (alunoId: string, questoes: number, horas: number | null) =>
  request<{ goal: MetaSemanal }>(`/mentoring/students/${alunoId}/goal/`, { method: 'PUT', body: JSON.stringify({ weekly_questions: questoes, weekly_hours: horas }) });
export const limparMeta = (alunoId: string) => request<void>(`/mentoring/students/${alunoId}/goal/`, { method: 'DELETE' });
