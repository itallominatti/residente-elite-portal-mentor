/**
 * Cálculos das abas do perfil. Funções puras: recebem o que a API entregou e
 * devolvem o que o gráfico mostra. O dia é sempre o de São Paulo.
 *
 * ## De onde vem cada número (e o que NÃO conta)
 *
 * - **Revisão espaçada** (`revision/evolution`): cada contato de revisão tem data,
 *   questões e acertos. É a fonte do acerto e do volume por semana.
 * - **Simulados registrados e revisões isoladas** (`revision/calendar-items`): a única
 *   fonte que o mentor lê hoje sem depender do ajuste de acesso do back-end.
 * - O que o aluno responde só no banco de questões ou em simulado da plataforma NÃO
 *   está nestas rotas. Os números daqui são "na revisão", e as telas dizem isso:
 *   não são o "feito na semana" do painel do aluno.
 *
 * Quando a evolução está disponível, os contatos dela já incluem as revisões
 * isoladas; por isso dos itens do calendário só entram os simulados registrados
 * (senão a isolada contaria duas vezes).
 */
import { FUSO } from '@/config';
import type { Agendamento, ContatoDaRevisao, ItemDoCalendario, TemaDaEvolucao } from '@/lib/api/revision';

export interface Atividade { dia: string; questoes: number; certas: number }

/** `yyyy-MM-dd` em São Paulo, de qualquer instante ISO. */
export const diaSPDe = (iso: string): string => new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO });

const meioDia = (dia: string) => new Date(`${dia}T12:00:00Z`);
export function somaDias(dia: string, n: number): string {
  const d = meioDia(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** O domingo da semana do dia (a semana do produto vai de domingo a sábado). */
export const domingoDe = (dia: string): string => somaDias(dia, -meioDia(dia).getUTCDay());
export const rotuloDoDia = (dia: string) => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`;

export function atividadesDe(contatos: ContatoDaRevisao[] | null, itens: ItemDoCalendario[]): Atividade[] {
  const out: Atividade[] = [];
  if (contatos) {
    for (const c of contatos) out.push({ dia: diaSPDe(c.contact_date), questoes: c.questions_done, certas: c.questions_correct });
    for (const i of itens) if (i.kind === 'registered_simulado') out.push({ dia: i.date, questoes: i.questions_total, certas: i.questions_correct });
  } else {
    for (const i of itens) out.push({ dia: i.date, questoes: i.questions_total, certas: i.questions_correct });
  }
  return out;
}

const porDia = (ats: Atividade[]) => {
  const m = new Map<string, { questoes: number; certas: number }>();
  for (const a of ats) {
    const x = m.get(a.dia) ?? { questoes: 0, certas: 0 };
    x.questoes += a.questoes; x.certas += a.certas;
    m.set(a.dia, x);
  }
  return m;
};

export interface SerieSemanal { inicios: string[]; rotulos: string[]; questoes: number[]; acerto: (number | null)[] }

/** As últimas `n` semanas (a atual por último). Semana sem questões: acerto `null` (lacuna no gráfico). */
export function serieSemanal(ats: Atividade[], hoje: string, n = 12): SerieSemanal {
  const primeira = somaDias(domingoDe(hoje), -7 * (n - 1));
  const inicios = Array.from({ length: n }, (_, i) => somaDias(primeira, 7 * i));
  const q = Array<number>(n).fill(0), c = Array<number>(n).fill(0);
  for (const a of ats) {
    if (a.dia < primeira || a.dia > hoje) continue;
    const i = Math.floor((meioDia(a.dia).getTime() - meioDia(primeira).getTime()) / (7 * 86400000));
    if (i >= 0 && i < n) { q[i]! += a.questoes; c[i]! += a.certas; }
  }
  return { inicios, rotulos: inicios.map(rotuloDoDia), questoes: q, acerto: q.map((v, i) => (v > 0 ? Math.round((c[i]! / v) * 100) : null)) };
}

export interface Constancia { niveis: number[]; diasAtivos: number; diasNoPeriodo: number; sequenciaAtual: number; melhorSequencia: number }

const nivelDe = (questoes: number, ativo: boolean) => (questoes <= 0 ? (ativo ? 1 : 0) : questoes < 10 ? 1 : questoes < 25 ? 2 : questoes < 50 ? 3 : 4);

/** Grade de `n` semanas em colunas (domingo a sábado). Dias futuros ficam vazios. */
export function constancia(ats: Atividade[], hoje: string, n = 12): Constancia {
  const mapa = porDia(ats);
  const primeira = somaDias(domingoDe(hoje), -7 * (n - 1));
  const niveis: number[] = [];
  let diasAtivos = 0, diasNoPeriodo = 0, melhor = 0, corrente = 0;
  for (let i = 0; i < n * 7; i++) {
    const dia = somaDias(primeira, i);
    if (dia > hoje) { niveis.push(0); continue; }
    diasNoPeriodo++;
    const x = mapa.get(dia);
    niveis.push(nivelDe(x?.questoes ?? 0, !!x));
    if (x) { diasAtivos++; corrente++; melhor = Math.max(melhor, corrente); } else corrente = 0;
  }
  // Sequência atual: termina hoje; se hoje ainda está vazio, o dia em curso não a quebra.
  let seq = 0;
  for (let d = mapa.has(hoje) ? hoje : somaDias(hoje, -1); d >= primeira && mapa.has(d); d = somaDias(d, -1)) seq++;
  return { niveis, diasAtivos, diasNoPeriodo, sequenciaAtual: seq, melhorSequencia: melhor };
}

export interface Area { area: string; feitas: number; certas: number; acerto: number; temas: number }
export function porArea(temas: TemaDaEvolucao[]): Area[] {
  const m = new Map<string, Area>();
  for (const t of temas) {
    const nome = t.category_name || 'Sem área';
    const a = m.get(nome) ?? { area: nome, feitas: 0, certas: 0, acerto: 0, temas: 0 };
    a.feitas += t.total_questions_done; a.certas += t.total_questions_correct; a.temas += 1;
    m.set(nome, a);
  }
  return [...m.values()].map(a => ({ ...a, acerto: a.feitas ? Math.round((a.certas / a.feitas) * 100) : 0 })).filter(a => a.feitas > 0).sort((a, b) => b.feitas - a.feitas);
}

export const ROTULO_DA_ETAPA: Record<string, string> = { primeira: '1ª revisão', segunda: '2ª revisão', terceira: '3ª revisão', quarta: '4ª revisão', quinta: '5ª revisão' };
export interface ResumoDasRevisoes { pendentes: number; atrasadas: number; proximos7: number; porEtapa: { etapa: string; atrasadas: number }[] }

/** Atrasada = pendente com data anterior a hoje (dia de São Paulo). */
export function resumoDasRevisoes(ags: Agendamento[], hoje: string): ResumoDasRevisoes {
  const pend = ags.filter(a => !a.completed);
  const atras = pend.filter(a => diaSPDe(a.scheduled_date) < hoje);
  const fim = somaDias(hoje, 7);
  const por = new Map<string, number>();
  for (const a of atras) por.set(a.stage, (por.get(a.stage) ?? 0) + 1);
  return {
    pendentes: pend.length, atrasadas: atras.length,
    proximos7: pend.filter(a => { const d = diaSPDe(a.scheduled_date); return d >= hoje && d <= fim; }).length,
    porEtapa: [...por.entries()].map(([etapa, atrasadas]) => ({ etapa: ROTULO_DA_ETAPA[etapa] ?? etapa, atrasadas })).sort((a, b) => b.atrasadas - a.atrasadas),
  };
}

/** Acerto e volume das últimas duas semanas fechadas contra as duas anteriores, para o selo de tendência. */
export function tendencia(s: SerieSemanal): { recente: number | null; anterior: number | null; delta: number | null } {
  const media = (xs: number[], ys: (number | null)[]) => {
    let q = 0, c = 0;
    xs.forEach((v, i) => { if (ys[i] != null) { q += v; c += v * (ys[i]! / 100); } });
    return q ? Math.round((c / q) * 100) : null;
  };
  const n = s.questoes.length;
  const recente = media(s.questoes.slice(n - 3, n - 1), s.acerto.slice(n - 3, n - 1));
  const anterior = media(s.questoes.slice(n - 5, n - 3), s.acerto.slice(n - 5, n - 3));
  return { recente, anterior, delta: recente != null && anterior != null ? recente - anterior : null };
}
