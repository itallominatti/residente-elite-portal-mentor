/**
 * Leituras de revisão de um aluno.
 *
 * Duas famílias, e a diferença importa:
 *
 * - `calendar-items` e `students/<id>/resets` checam "quem atende o aluno"
 *   (`pode_acompanhar_aluno`): o mentor lê os da carteira; fora dela, 403.
 * - `evolution`, `priority-themes` e `schedules` usam `aluno_alvo`. Até o
 *   commit `226cc1e` do back-end (main), só honravam
 *   `?user_id=` para admin e devolviam ao mentor os dados DELE MESMO, em
 *   silêncio; a partir dele, o mentor lê quem atende e leva 403 fora do ramo. Por
 *   isso só são chamados por admin ou com `VITE_FEATURE_METRICAS_DO_MENTOR`
 *   ligada (depois desse back-end publicado).
 */
import { qs, request, todasAsPaginas } from '@/lib/http';

export interface ItemDoCalendario {
  kind: 'isolated_revision' | 'registered_simulado'; id: string; date: string; occurred_at: string;
  title: string; theme_id: string | null; category_name: string | null;
  questions_total: number; questions_correct: number; accuracy_percentage: number;
}
export const getItensDoCalendario = (alunoId: string, start: string, end: string) =>
  request<{ timezone: string; start: string; end: string; items: ItemDoCalendario[] }>(`/revision/calendar-items/${qs({ user_id: alunoId, start, end })}`);

export interface Recomeco { id: string; reset_at: string; themes_restarted: number; schedules_pending_removed: number; mentor_suggestions_removed: number }
export const getRecomecos = (alunoId: string) => request<{ results: Recomeco[] }>(`/revision/students/${alunoId}/resets/`);

// ---- só admin hoje (ou para o mentor, com o back-end do commit 226cc1e no ar) ----
export interface ContatoDaRevisao {
  id: string; contact_type: string; contact_date: string; questions_done: number; questions_correct: number;
  accuracy_percentage: number; notes?: string;
}
export interface TemaDaEvolucao {
  theme_id: string; theme_name: string; theme_weight?: string; category_name: string;
  total_questions_done: number; total_questions_correct: number; overall_accuracy: number;
  current_stage: string; next_scheduled_date?: string | null; contacts: ContatoDaRevisao[];
}
export interface ResumoDaEvolucao { total_themes: number; total_questions_done: number; total_questions_correct: number; overall_accuracy: number; total_schedules_completed: number; total_schedules_pending: number }
export interface Evolucao { summary: ResumoDaEvolucao; temas: TemaDaEvolucao[] }

interface PaginaDaEvolucao { summary: ResumoDaEvolucao; results: TemaDaEvolucao[]; total_pages?: number }

/** Toda a evolução do aluno (50 temas por página é o teto do servidor; para em 20 páginas). */
export async function getEvolucao(alunoId: string): Promise<Evolucao> {
  let resumo: ResumoDaEvolucao | null = null;
  const temas = await todasAsPaginas<TemaDaEvolucao>(async p => {
    const r = await request<PaginaDaEvolucao>(`/revision/evolution/${qs({ user_id: alunoId, page: p, page_size: 50 })}`);
    if (p === 1) resumo = r.summary;
    return { itens: r.results ?? [], temProxima: p < (r.total_pages ?? 1) };
  });
  return { summary: resumo ?? { total_themes: 0, total_questions_done: 0, total_questions_correct: 0, overall_accuracy: 0, total_schedules_completed: 0, total_schedules_pending: 0 }, temas };
}

export interface TemaPrioritario {
  theme_id: string; theme_name: string; theme_weight?: string; category_name: string;
  total_questions_done: number; total_questions_correct?: number; overall_accuracy: number;
  current_stage?: string; next_scheduled_date?: string | null;
}
export interface NivelDePrioridade { key: 'critico' | 'prioritario' | 'suporte_secundario'; title: string; count: number; themes: TemaPrioritario[] }
export const getTemasPrioritarios = (alunoId: string) =>
  request<{ summary: { critico: number; prioritario: number; suporte_secundario: number; total_evaluated: number }; levels: NivelDePrioridade[] }>(`/revision/priority-themes/${qs({ user_id: alunoId })}`);

export interface Agendamento {
  id: string; theme_id?: string; theme_name: string; category_name?: string | null; stage: string;
  scheduled_date: string; completed: boolean; completed_at?: string | null;
  suggested_questions?: number | null; rescheduled_count?: number;
}
export const getAgendamentos = (alunoId: string, pendingOnly = false) =>
  request<Agendamento[]>(`/revision/schedules/${qs({ user_id: alunoId, pending_only: pendingOnly ? 'true' : undefined })}`);
export const getAgendamentosPendentes = (alunoId: string) => getAgendamentos(alunoId, true);

/** Define ou limpa (`null`) a sugestão de questões do mentor para uma revisão. */
export const definirSugestaoDeQuestoes = (scheduleId: string, suggestedQuestions: number | null) =>
  request<Agendamento>(`/revision/schedules/${scheduleId}/suggestion/`, {
    method: 'PATCH', body: JSON.stringify({ suggested_questions: suggestedQuestions }),
  });

// ---- questionário de perfil do aluno ----
export interface QuestionarioDoAluno {
  id: string; institutes: string[]; especialties: string[]; current_year: string; created_at: string; updated_at: string;
}
export const getQuestionario = (alunoId: string) =>
  request<QuestionarioDoAluno[]>(`/questionary/${qs({ user_id: alunoId })}`);
