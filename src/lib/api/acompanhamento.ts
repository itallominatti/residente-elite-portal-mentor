/**
 * Acompanhamento do mentor: carteira com indicadores, estudo do aluno, contatos,
 * anotações privadas, agenda, plano e "ver como" com trilha.
 * Espelha `views_acompanhamento.py`, `views_ver_como.py` e `views.py` do
 * elite-med-back-end (branch `feat/api-do-portal-do-mentor`). Tudo isto fica
 * atrás de `FEATURES.acompanhamento` até o servidor estar no ar.
 */
import { qs, request, todasAsPaginas } from '@/lib/http';
import type { Motivo } from '@/lib/api/mentoring';

// ---------- carteira com indicadores ----------
export interface Indicadores {
  acerto_recente: number | null; respostas_recentes: number; acerto_anterior: number | null; variacao_do_acerto: number | null;
  questoes_na_semana: number; meta_semanal: number | null; pct_da_meta: number | null;
  revisoes_atrasadas: number; revisoes_de_hoje: number; dias_sem_questao: number | null;
}
export interface AlunoComIndicadores { id: string; nome: string; email: string; indicadores: Indicadores; motivos: Motivo[]; simulado_parado: string | null }
interface PaginaDaCarteira { results: AlunoComIndicadores[]; pagina: number; total_de_paginas: number }

/** `mentorId` só vale para admin ("ver como"): o servidor recusa o de outra pessoa para quem não é. */
export const getCarteiraComIndicadores = (mentorId?: string | null) => todasAsPaginas<AlunoComIndicadores>(async p => {
  const r = await request<PaginaDaCarteira>(`/mentoring/carteira/${qs({ page: p, page_size: 200, mentor_id: mentorId })}`);
  return { itens: r.results ?? [], temProxima: r.pagina < r.total_de_paginas };
});

// ---------- o que o aluno estudou ----------
export interface SimuladoFeito { id: string; titulo: string; finalizado_em: string; nota: number | null; acertos: number; erros: number }
export interface LinhaDeDesempenho { label: string; answered: number; correct: number; accuracy: number; is_significant: boolean; delta: number | null }
export interface EstudoDoAluno {
  gerado_em: string;
  simulados: { total_finalizados: number; finalizados: SimuladoFeito[]; parados: { id: string; titulo: string; comecou_em: string }[] };
  desempenho: { por_area: { rows: LinhaDeDesempenho[] }; por_tema: { rows: LinhaDeDesempenho[] } };
  caderno_de_erros: { total: number; ultimos_30_dias: number; por_motivo: { motivo: string; rotulo: string; total: number }[]; por_area: { area: string; total: number }[] };
  flashcards: {
    cartoes_agendados: number; atrasados: number; para_hoje: number; sessoes_ultimos_14_dias: number; ultima_sessao_em: string | null;
    avaliacoes_ultimos_30_dias: { facil: number; medio: number; dificil: number }; minutos_na_semana: number;
  };
  foco: { registra_sessoes: boolean; rotinas: { nome: string; minutos_de_foco: number; minutos_de_pausa: number; rodadas: number }[] };
}
export const getEstudo = (alunoId: string) => request<EstudoDoAluno>(`/mentoring/students/${alunoId}/estudo/`);

/** Uma questão que o aluno respondeu: o enunciado vem resumido e sem gabarito, alternativas nem comentário. */
export interface RespostaDoAluno {
  id: string; respondida_em: string; acertou: boolean | null; tentativa_id: string; simulado: string; modo: string | null; tentativa_finalizada: boolean;
  questao_id: string; enunciado: string; area: string | null; tema: string | null; subtema: string | null;
}
export interface PaginaDeRespostas { total: number; pagina: number; por_pagina: number; total_de_paginas: number; results: RespostaDoAluno[] }
export const getRespostas = (alunoId: string, o: { pagina?: number; acerto?: boolean; tentativaId?: string } = {}) =>
  request<PaginaDeRespostas>(`/mentoring/students/${alunoId}/respostas/${qs({ page: o.pagina, acerto: o.acerto, tentativa_id: o.tentativaId })}`);

// ---------- contatos ----------
export type Canal = 'mensagem' | 'ligacao' | 'video' | 'presencial';
export type Humor = 'desanimado' | 'neutro' | 'aliviado' | 'motivado';
export const CANAIS: { valor: Canal; rotulo: string }[] = [
  { valor: 'video', rotulo: 'Videochamada' }, { valor: 'ligacao', rotulo: 'Ligação' }, { valor: 'mensagem', rotulo: 'Mensagem' }, { valor: 'presencial', rotulo: 'Presencial' },
];
export const HUMORES: { valor: Humor; rotulo: string }[] = [
  { valor: 'desanimado', rotulo: 'Desanimado' }, { valor: 'neutro', rotulo: 'Neutro' }, { valor: 'aliviado', rotulo: 'Aliviado' }, { valor: 'motivado', rotulo: 'Motivado' },
];
export const rotuloDoCanal = (c: string | null | undefined) => CANAIS.find(x => x.valor === c)?.rotulo ?? '';
export const rotuloDoHumor = (h: string | null | undefined) => HUMORES.find(x => x.valor === h)?.rotulo ?? '';

export interface Contato {
  id: string; student_id: string; author_id: string; author_name: string; channel: Canal; occurred_at: string;
  duration_min: number | null; summary: string; mood: Humor | null; created_at: string;
}
export interface NovoContato {
  canal: Canal; resumo: string; humor?: Humor | null; duracao_min?: number | null; ocorreu_em?: string;
  proximos_passos?: { titulo: string; prazo?: string }[];
  proximo_contato?: { quando: string; canal?: Canal; convite_meet?: boolean; duracao_min?: number };
}

/** O que aconteceu com o convite do Meet pedido junto com o registro: o registro fica mesmo se o Google falhar. */
export interface ResultadoDoConvite { meet_url: string | null; erro: string | null; code: string | null }
export const listarContatos = (alunoId: string) => request<{ results: Contato[] }>(`/mentoring/students/${alunoId}/contatos/`).then(r => r.results);
export const registrarContato = (alunoId: string, c: NovoContato) =>
  request<Contato & { convite?: ResultadoDoConvite }>(`/mentoring/students/${alunoId}/contatos/`, { method: 'POST', body: JSON.stringify(c) });
export const excluirContato = (id: string) => request<void>(`/mentoring/contatos/${id}/`, { method: 'DELETE' });

// ---------- anotações privadas ----------
export interface Nota { id: string; student_id: string; body: string; sensitive: boolean; created_at: string; updated_at: string }
export const listarNotas = (alunoId: string) => request<{ results: Nota[] }>(`/mentoring/students/${alunoId}/notas/`).then(r => r.results);
export const criarNota = (alunoId: string, texto: string, sensivel: boolean) =>
  request<Nota>(`/mentoring/students/${alunoId}/notas/`, { method: 'POST', body: JSON.stringify({ texto, sensivel }) });
export const editarNota = (id: string, texto: string) => request<Nota>(`/mentoring/notas/${id}/`, { method: 'PATCH', body: JSON.stringify({ texto }) });
export const excluirNota = (id: string) => request<void>(`/mentoring/notas/${id}/`, { method: 'DELETE' });

// ---------- agenda e pendências ----------
export interface Pendencia {
  id: string; student_id: string | null; student_name: string | null; kind: 'tarefa' | 'contato'; channel: Canal | null;
  title: string; due_at: string | null; done_at: string | null; source_contact_id: string | null; created_at: string;
  /** Link do Meet, quando o convite foi enviado ao aluno. */
  meet_url: string | null;
  /** Duração do encontro, para o tamanho do bloco no calendário. */
  meet_duration_min: number;
  /** Cor escolhida no calendário (`CORES`); `null` = a padrão do tipo. */
  color: string | null;
}
/** `mentorId`: só admin, dentro de um "ver como" sobre esse mentor; o servidor recusa fora disso. */
export interface FiltroDePendencias { feitas?: boolean; de?: string; ate?: string; alunoId?: string; mentorId?: string }
export const listarPendencias = (f: FiltroDePendencias = {}) =>
  request<{ results: Pendencia[] }>(`/mentoring/pendencias/${qs({ feitas: f.feitas, de: f.de, ate: f.ate, aluno_id: f.alunoId, mentor_id: f.mentorId })}`).then(r => r.results);
export interface NovaPendencia {
  titulo: string; tipo?: 'tarefa' | 'contato'; aluno_id?: string | null; para_quando?: string | null; canal?: Canal | null;
  convite_meet?: boolean; duracao_min?: number; cor?: string | null;
}
export const criarPendencia = (p: NovaPendencia) => request<Pendencia & { convite?: ResultadoDoConvite }>('/mentoring/pendencias/', { method: 'POST', body: JSON.stringify(p) });
export const marcarPendencia = (id: string, feita: boolean) => request<Pendencia>(`/mentoring/pendencias/${id}/`, { method: 'PATCH', body: JSON.stringify({ feita }) });
/** Muda a data e hora, a cor ou o título. Com convite do Meet, o servidor avisa o Google antes e, se ele falhar, nada muda. */
export const atualizarPendencia = (id: string, campos: { para_quando?: string | null; cor?: string | null; titulo?: string; feita?: boolean }) =>
  request<Pendencia>(`/mentoring/pendencias/${id}/`, { method: 'PATCH', body: JSON.stringify(campos) });
export const excluirPendencia = (id: string) => request<void>(`/mentoring/pendencias/${id}/`, { method: 'DELETE' });

// ---------- revisões dos alunos (calendário) ----------
export interface RevisaoDoAluno {
  id: string; student_id: string; student_name: string; theme_id: string; theme_name: string; category_name: string | null; stage: string;
  scheduled_date: string; completed: boolean; completed_at: string | null; moved_by_name: string | null; moved_at: string | null;
}
export interface FiltroDeRevisoes { de: string; ate: string; alunoId?: string; mentorId?: string; concluidas?: boolean }
/** As revisões agendadas da carteira no período (até 100 dias). `mentorId`: só admin; em "ver como" o servidor já usa o mentor visto. */
export const listarRevisoes = (f: FiltroDeRevisoes) =>
  request<{ results: RevisaoDoAluno[] }>(`/mentoring/revisoes/${qs({ de: f.de, ate: f.ate, aluno_id: f.alunoId, mentor_id: f.mentorId, concluidas: f.concluidas })}`).then(r => r.results);
export interface RevisaoRemarcada extends RevisaoDoAluno { no_mesmo_dia: number }
/** Remarca para o dia e a hora exatos. O servidor guarda quem mexeu e avisa quantas outras revisões do aluno caem no dia. */
export const remarcarRevisao = (id: string, paraQuando: string) =>
  request<RevisaoRemarcada>(`/mentoring/revisoes/${id}/`, { method: 'PATCH', body: JSON.stringify({ para_quando: paraQuando }) });

// ---------- conta Google e convite do Meet ----------
export interface StatusDoGoogle { enabled: boolean; connected: boolean; google_email: string | null }
export const getGoogle = () => request<StatusDoGoogle>('/mentoring/google/');
/** O servidor devolve a URL de autorização do Google; o portal navega para ela e o Google volta para `/agenda?google=...`. */
export const iniciarConexaoGoogle = () => request<{ url: string }>('/mentoring/google/connect/', { method: 'POST' }).then(r => r.url);
export const desconectarGoogle = () => request<void>('/mentoring/google/', { method: 'DELETE' });
export const DURACOES_DO_MEET = [30, 45, 60, 90] as const;
export const enviarConviteMeet = (pendenciaId: string, duracaoMin?: number) =>
  request<Pendencia>(`/mentoring/pendencias/${pendenciaId}/meet/`, { method: 'POST', body: JSON.stringify(duracaoMin ? { duracao_min: duracaoMin } : {}) });
export const cancelarConviteMeet = (pendenciaId: string) => request<Pendencia>(`/mentoring/pendencias/${pendenciaId}/meet/`, { method: 'DELETE' });

// ---------- plano do aluno ----------
export interface Objetivo {
  id: string; student_id: string; author_id: string; author_name: string; title: string; detail: string;
  due_date: string | null; progress: number; done_at: string | null; created_at: string; updated_at: string;
}
export interface NovoObjetivo { titulo: string; detalhe?: string; prazo?: string | null; progresso?: number }
export const listarObjetivos = (alunoId: string) => request<{ results: Objetivo[] }>(`/mentoring/students/${alunoId}/plano/`).then(r => r.results);
export const criarObjetivo = (alunoId: string, o: NovoObjetivo) =>
  request<Objetivo>(`/mentoring/students/${alunoId}/plano/`, { method: 'POST', body: JSON.stringify(o) });
export const atualizarObjetivo = (id: string, campos: { progresso?: number; concluido?: boolean; titulo?: string; detalhe?: string; prazo?: string | null }) =>
  request<Objetivo>(`/mentoring/plano/${id}/`, { method: 'PATCH', body: JSON.stringify(campos) });
export const excluirObjetivo = (id: string) => request<void>(`/mentoring/plano/${id}/`, { method: 'DELETE' });

// ---------- "ver como" e trilha ----------
export type MotivoDoVerComo = 'suporte' | 'qualidade' | 'denuncia' | 'lgpd' | 'outro';
export const MOTIVOS_DO_VER_COMO: { valor: MotivoDoVerComo; rotulo: string }[] = [
  { valor: 'qualidade', rotulo: 'Revisão de qualidade do atendimento' }, { valor: 'suporte', rotulo: 'Suporte ao mentor' },
  { valor: 'denuncia', rotulo: 'Denúncia ou reclamação de aluno' }, { valor: 'lgpd', rotulo: 'Solicitação de titular de dados (LGPD)' }, { valor: 'outro', rotulo: 'Outro' },
];
export const rotuloDoMotivo = (m: string) => MOTIVOS_DO_VER_COMO.find(x => x.valor === m)?.rotulo ?? m;

export interface SessaoAberta { id: string; mentor_id: string; started_at: string; expires_after_idle_seconds: number }
export const abrirVerComo = (mentorId: string, motivo: MotivoDoVerComo, detalhe: string) =>
  request<SessaoAberta>('/mentoring/ver-como/', { method: 'POST', body: JSON.stringify({ mentor_id: mentorId, motivo, detalhe }) }, { semVerComo: true });
export const encerrarVerComo = (sessaoId: string) =>
  request<void>(`/mentoring/ver-como/${sessaoId}/encerrar/`, { method: 'POST' }, { semVerComo: true });

export interface LinhaDaTrilha {
  id: string; admin_id: string; admin_name: string; mentor_id: string; mentor_name: string; reason: string; detail: string;
  started_at: string; last_seen_at: string; ended_at: string | null; ip_address: string | null; accesses: number;
}
export interface EventoDaTrilha { at: string; method: string; route: string; student_id: string | null; student_name: string | null }
export const getTrilha = (mentorId?: string) => request<{ results: LinhaDaTrilha[] }>(`/mentoring/ver-como/auditoria/${qs({ mentor_id: mentorId })}`).then(r => r.results);
export const getSessaoDaTrilha = (id: string) => request<{ session: LinhaDaTrilha; events: EventoDaTrilha[] }>(`/mentoring/ver-como/${id}/auditoria/`);

/** Nome legível de uma rota da API, para a trilha ("mentoring-student-estudo" → "Estudo do aluno"). */
export const ROTULO_DA_ROTA: Record<string, string> = {
  'mentoring-student-estudo': 'Estudo do aluno', 'mentoring-carteira': 'Carteira', 'mentoring-contatos': 'Contatos do aluno',
  'mentoring-plano': 'Plano do aluno', 'mentoring-student-goal': 'Meta semanal',
};
export const rotuloDaRota = (r: string) => ROTULO_DA_ROTA[r] ?? r;
