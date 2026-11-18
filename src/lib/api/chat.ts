/** Chat de mentoria: as rotas `mentoring/chat/` do back-end, as mesmas do hub e do learner. */
import { qs, request } from '@/lib/http';

export interface Conversa {
  /** `null` = aluno da carteira que ainda não tem conversa ("a iniciar"). */
  id: string | null;
  student_id: string; student_name: string; mentor_id: string; mentor_name: string;
  last_message_at: string | null; last_message_preview: string;
  /** Quem falou por último. Última do aluno = esperando resposta. */
  last_message_author_is_student: boolean;
  unread_count: number;
  /** Decidido pelo servidor. Sem `true` explícito, a tela não oferece escrever. */
  can_write?: boolean;
}
export interface Mensagem { id: string; author_id: string; author_name: string; body: string; created_at: string }

export const listarConversas = async () =>
  (await request<{ data: Conversa[] }>(`/mentoring/chat/threads/${qs({ page_size: 200 })}`)).data ?? [];
export const listarMensagens = async (id: string, depoisDe?: string) =>
  (await request<{ results: Mensagem[] }>(`/mentoring/chat/threads/${id}/messages/${qs({ after: depoisDe })}`)).results ?? [];
export const enviarMensagem = (id: string, body: string) =>
  request<Mensagem>(`/mentoring/chat/threads/${id}/messages/`, { method: 'POST', body: JSON.stringify({ body }) });
export const marcarLida = (id: string) => request<void>(`/mentoring/chat/threads/${id}/read/`, { method: 'POST' });
/** Abre (ou reusa) a conversa do ramo com o aluno sem mandar mensagem. 403 fora do ramo. */
export async function abrirConversa(alunoId: string): Promise<Conversa> {
  const c = await request<Conversa | null>('/mentoring/chat/threads/open/', { method: 'POST', body: JSON.stringify({ student_id: alunoId }) });
  if (!c?.id) throw new Error('O servidor não devolveu a conversa.');
  return c;
}

/**
 * A fila do mentor: quem espera resposta há mais tempo primeiro; depois as
 * demais, da mais recente para a mais antiga. Mesma regra do hub
 * (`mentorChatOrdering.ts`): ordenar só por atividade enterraria o aluno que
 * perguntou ontem e não foi respondido.
 */
export function ordenarPorEspera(cs: Conversa[]): Conversa[] {
  const t = (c: Conversa) => (c.last_message_at ? new Date(c.last_message_at).getTime() : 0);
  const esperando = cs.filter(c => c.id && c.last_message_author_is_student).sort((a, b) => t(a) - t(b));
  const resto = cs.filter(c => c.id && !c.last_message_author_is_student).sort((a, b) => t(b) - t(a));
  const aIniciar = cs.filter(c => !c.id).sort((a, b) => a.student_name.localeCompare(b.student_name, 'pt-BR'));
  return [...esperando, ...resto, ...aIniciar];
}
