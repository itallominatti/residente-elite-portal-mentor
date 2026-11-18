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
import { qs, request } from '@/lib/http';

export interface ItemDoCalendario {
  kind: 'isolated_revision' | 'registered_simulado'; id: string; date: string; occurred_at: string;
  title: string; theme_id: string | null; category_name: string | null;
  questions_total: number; questions_correct: number; accuracy_percentage: number;
}
export const getItensDoCalendario = (alunoId: string, start: string, end: string) =>
  request<{ timezone: string; start: string; end: string; items: ItemDoCalendario[] }>(`/revision/calendar-items/${qs({ user_id: alunoId, start, end })}`);

export interface Recomeco { id: string; reset_at: string; themes_restarted: number; schedules_pending_removed: number; mentor_suggestions_removed: number }
export const getRecomecos = (alunoId: string) => request<{ results: Recomeco[] }>(`/revision/students/${alunoId}/resets/`);

// ---- só admin hoje (ou com o ajuste do servidor) ----
export interface ResumoDaEvolucao { total_themes: number; total_questions_done: number; total_questions_correct: number; overall_accuracy: number; total_schedules_completed: number; total_schedules_pending: number }
export const getEvolucao = (alunoId: string) =>
  request<{ summary: ResumoDaEvolucao }>(`/revision/evolution/${qs({ user_id: alunoId, page: 1, page_size: 1 })}`);

export interface TemaPrioritario { theme_id: string; theme_name: string; category_name: string; total_questions_done: number; overall_accuracy: number }
export interface NivelDePrioridade { key: 'critico' | 'prioritario' | 'suporte_secundario'; title: string; count: number; themes: TemaPrioritario[] }
export const getTemasPrioritarios = (alunoId: string) =>
  request<{ summary: { critico: number; prioritario: number; suporte_secundario: number; total_evaluated: number }; levels: NivelDePrioridade[] }>(`/revision/priority-themes/${qs({ user_id: alunoId })}`);

export interface Agendamento { id: string; theme_name: string; stage: string; scheduled_date: string; completed: boolean }
export const getAgendamentosPendentes = (alunoId: string) =>
  request<Agendamento[]>(`/revision/schedules/${qs({ user_id: alunoId, pending_only: 'true' })}`);
