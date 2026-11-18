/**
 * A carteira do mentor: junta a lista de mentorandos, o radar e as conversas
 * numa linha por aluno, e decide a situação. Função pura: as telas só mostram.
 *
 * Situação, a partir das 5 regras do radar (que são do servidor):
 *   alerta  -> dois motivos ou mais, ou "sem responder questão" (sumir é o pior sinal)
 *   atencao -> um motivo
 *   novo    -> sem motivo e sem nenhuma conversa ainda (falta o primeiro contato)
 *   ok      -> o resto
 */
import type { AlunoDaCarteira, AlunoNoRadar, Motivo } from '@/lib/api/mentoring';
import type { Conversa } from '@/lib/api/chat';
import type { AlunoComIndicadores, Indicadores } from '@/lib/api/acompanhamento';

export type Situacao = 'alerta' | 'atencao' | 'novo' | 'ok';
export const ORDEM_DA_SITUACAO: Record<Situacao, number> = { alerta: 0, atencao: 1, novo: 2, ok: 3 };
export const ROTULO_DA_SITUACAO: Record<Situacao, string> = { alerta: 'Em alerta', atencao: 'Atenção', novo: 'Sem contato', ok: 'Em dia' };
export const TOM_DA_SITUACAO: Record<Situacao, 'bad' | 'amber' | 'blue' | 'ok'> = { alerta: 'bad', atencao: 'amber', novo: 'blue', ok: 'ok' };

export interface Mentorando {
  id: string; nome: string; email: string; mentores: string[];
  situacao: Situacao; motivos: Motivo[]; resumo: string[]; rascunho: string;
  conversaId: string | null; podeEscrever: boolean;
  esperandoDesde: string | null; naoLidas: number;
  ultimaMensagemDoRamo: string | null; ultimaMensagemEm: string | null; previa: string;
  /** Acerto, meta e revisões, do servidor (`/mentoring/carteira/`). `null` enquanto a função está desligada. */
  indicadores: Indicadores | null;
}

export function situacaoDe(motivos: Motivo[], temConversa: boolean): Situacao {
  if (motivos.length >= 2 || motivos.some(m => m.codigo === 'sem_questoes_7d')) return 'alerta';
  if (motivos.length === 1) return 'atencao';
  return temConversa ? 'ok' : 'novo';
}

export interface Escopo {
  /** Para o admin: só os alunos deste mentor ("ver como" ou o segundo chapéu). Mentor: `null`, o servidor já recortou. */
  mentorId: string | null;
}

export function montarCarteira(alunos: AlunoDaCarteira[], radar: AlunoNoRadar[], conversas: Conversa[], escopo: Escopo, indicadores: AlunoComIndicadores[] = []): Mentorando[] {
  const indicadoresDe = new Map(indicadores.map(i => [i.id, i.indicadores]));
  const doEscopo = escopo.mentorId ? alunos.filter(a => a.mentorships.some(v => v.mentor_id === escopo.mentorId)) : alunos;
  const porAluno = new Map(radar.map(r => [r.id, r]));
  const conversasDoEscopo = escopo.mentorId ? conversas.filter(c => c.mentor_id === escopo.mentorId) : conversas;
  const conversaDe = new Map<string, Conversa>();
  for (const c of conversasDoEscopo) {
    const atual = conversaDe.get(c.student_id);
    // Um aluno pode ter vários mentores; fica a conversa com id e, entre elas, a mais recente.
    if (!atual || (!atual.id && c.id) || ((c.last_message_at ?? '') > (atual.last_message_at ?? '') && c.id)) conversaDe.set(c.student_id, c);
  }
  return doEscopo.map(a => {
    const r = porAluno.get(a.id), c = conversaDe.get(a.id);
    const motivos = r?.motivos ?? [];
    const temConversa = !!(c?.id && c.last_message_at) || !!r?.ultima_mensagem_do_ramo_em;
    return {
      id: a.id, nome: a.full_name || r?.nome || a.email, email: a.email,
      mentores: a.mentorships.map(v => v.mentor_name),
      situacao: situacaoDe(motivos, temConversa), motivos, resumo: r?.resumo ?? [], rascunho: r?.rascunho ?? '',
      conversaId: c?.id ?? r?.conversa_id ?? null,
      podeEscrever: c?.can_write === true || r?.pode_escrever === true,
      esperandoDesde: c?.id && c.last_message_author_is_student ? c.last_message_at : null,
      naoLidas: c?.unread_count ?? 0,
      ultimaMensagemDoRamo: r?.ultima_mensagem_do_ramo_em ?? null,
      ultimaMensagemEm: c?.last_message_at ?? null,
      previa: c?.last_message_preview ?? '',
      indicadores: indicadoresDe.get(a.id) ?? null,
    };
  });
}

/** Mais grave primeiro; dentro da mesma situação, quem espera resposta há mais tempo; depois o nome. */
export function ordenarPorUrgencia(ms: Mentorando[]): Mentorando[] {
  return [...ms].sort((a, b) =>
    ORDEM_DA_SITUACAO[a.situacao] - ORDEM_DA_SITUACAO[b.situacao]
    || b.motivos.length - a.motivos.length
    || (a.esperandoDesde ? 0 : 1) - (b.esperandoDesde ? 0 : 1)
    || (a.esperandoDesde ?? '').localeCompare(b.esperandoDesde ?? '')
    || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type OrdemPorIndicador = 'acerto' | 'meta' | 'revisoes';

/** Quem mais precisa primeiro em cada coluna; quem não tem o número (sem respostas, sem meta) vai para o fim. */
export function ordenarPorIndicador(ms: Mentorando[], por: OrdemPorIndicador): Mentorando[] {
  const valor = (m: Mentorando): number | null => {
    const i = m.indicadores;
    if (!i) return null;
    if (por === 'acerto') return i.acerto_recente;
    if (por === 'meta') return i.pct_da_meta;
    return i.revisoes_atrasadas ? -i.revisoes_atrasadas : 0;
  };
  return [...ms].sort((a, b) => {
    const x = valor(a), y = valor(b);
    if (x === null && y === null) return a.nome.localeCompare(b.nome, 'pt-BR');
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y || a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

export function contar(ms: Mentorando[]) {
  const c = { total: ms.length, alerta: 0, atencao: 0, novo: 0, ok: 0, esperando: 0 };
  for (const m of ms) { c[m.situacao]++; if (m.esperandoDesde) c.esperando++; }
  return c;
}
