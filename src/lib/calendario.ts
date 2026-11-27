/**
 * Calendário estilo Google Calendar: funções puras de data, posição e sobreposição.
 *
 * Tudo é calculado no fuso de São Paulo (`FUSO`), não no do navegador: o mentor vê o mesmo horário de
 * onde estiver. O Brasil não tem horário de verão desde 2019, então o fuso é fixo (-03:00); se ele
 * voltar, `DESLOCAMENTO` e `paraIso` são os únicos pontos a mudar.
 */
import { FUSO } from '@/config';

/** `yyyy-MM-dd`, no fuso de São Paulo. */
export type Dia = string;
export const MINUTOS_NO_DIA = 24 * 60;
export const PASSO_MIN = 15;
const DESLOCAMENTO = '-03:00';

export const CORES = ['azul', 'verde', 'amarelo', 'laranja', 'vermelho', 'roxo', 'rosa', 'cinza'] as const;
export type Cor = (typeof CORES)[number];
export const ROTULO_DA_COR: Record<Cor, string> = { azul: 'Azul', verde: 'Verde', amarelo: 'Amarelo', laranja: 'Laranja', vermelho: 'Vermelho', roxo: 'Roxo', rosa: 'Rosa', cinza: 'Cinza' };

// -- dias ---------------------------------------------------------------------------------

const noMeioDoDia = (dia: Dia) => new Date(`${dia}T12:00:00${DESLOCAMENTO}`);
const formatarDia = (d: Date): Dia => d.toLocaleDateString('en-CA', { timeZone: FUSO });

export const diaDe = (iso: string | Date): Dia => formatarDia(typeof iso === 'string' ? new Date(iso) : iso);

export function somarDias(dia: Dia, n: number): Dia {
  return formatarDia(new Date(noMeioDoDia(dia).getTime() + n * 86_400_000));
}

/** 0 = domingo. */
export const diaDaSemana = (dia: Dia): number => ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[noMeioDoDia(dia).toLocaleDateString('en-US', { timeZone: FUSO, weekday: 'short' })]!;

/** A semana começa no domingo, como no calendário brasileiro e no Google Calendar daqui. */
export const inicioDaSemana = (dia: Dia): Dia => somarDias(dia, -diaDaSemana(dia));
export const diasDaSemana = (dia: Dia): Dia[] => Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(dia), i));

export const NOME_DO_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;
const NOME_DO_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const partes = (dia: Dia) => { const [a, m, d] = dia.split('-').map(Number); return { a: a!, m: m!, d: d! }; };
export const numeroDoDia = (dia: Dia) => partes(dia).d;

/** "novembro de 2026", ou "29 nov – 5 dez 2026" quando a semana cruza o mês. */
export function rotuloDoPeriodo(dias: Dia[]): string {
  const p = partes(dias[0]!), u = partes(dias[dias.length - 1]!);
  if (dias.length === 1) return `${p.d} de ${NOME_DO_MES[p.m - 1]} de ${p.a}`;
  if (p.m === u.m) return `${NOME_DO_MES[p.m - 1]} de ${p.a}`;
  const curto = (m: number) => NOME_DO_MES[m - 1]!.slice(0, 3);
  return `${p.d} ${curto(p.m)} – ${u.d} ${curto(u.m)} ${u.a}`;
}

// -- horas --------------------------------------------------------------------------------

/** Minutos desde 00:00 em São Paulo. */
export function minutoNoDia(iso: string | Date): number {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const [h, m] = d.toLocaleTimeString('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
  return (h! % 24) * 60 + m!;
}

const dois = (n: number) => String(n).padStart(2, '0');
export const horaDoMinuto = (min: number) => `${dois(Math.floor(min / 60) % 24)}:${dois(min % 60)}`;

/** O instante (ISO em UTC) de um dia e minuto de São Paulo. */
export function paraIso(dia: Dia, minuto: number): string {
  const m = Math.max(0, Math.min(MINUTOS_NO_DIA - 1, Math.round(minuto)));
  return new Date(`${dia}T${dois(Math.floor(m / 60))}:${dois(m % 60)}:00${DESLOCAMENTO}`).toISOString();
}

export const arredondar = (min: number, passo = PASSO_MIN) => Math.round(min / passo) * passo;
export const limitar = (min: number, de = 0, ate = MINUTOS_NO_DIA - PASSO_MIN) => Math.max(de, Math.min(ate, min));

/** O ISO de um dia e minuto, mais `minutos` à frente (que pode virar o dia seguinte). */
export const somarMinutos = (iso: string, minutos: number) => new Date(new Date(iso).getTime() + minutos * 60_000).toISOString();

// -- eventos ------------------------------------------------------------------------------

export type TipoDeEvento = 'pendencia' | 'contato' | 'revisao';

export interface EventoDoCalendario<T = unknown> {
  id: string;
  tipo: TipoDeEvento;
  titulo: string;
  subtitulo?: string;
  /** Instante de início (ISO). */
  inicio: string;
  duracaoMin: number;
  cor: Cor;
  concluido: boolean;
  /** Só arrasta quem pode mexer: revisão concluída e "ver como" não arrastam. */
  arrastavel: boolean;
  origem: T;
}

/** Cor padrão de uma revisão pela etapa (aceita etapas reais do banco e códigos legados). */
export const COR_DA_ETAPA: Record<string, Cor> = {
  primeira: 'laranja', segunda: 'amarelo', terceira: 'roxo', quarta: 'rosa', quinta: 'cinza',
  d1: 'laranja', d7: 'amarelo', d30: 'roxo', d60: 'rosa', manutencao: 'cinza',
};
export const ROTULO_DA_ETAPA: Record<string, string> = {
  primeira: '1ª rev.', segunda: '2ª rev.', terceira: '3ª rev.', quarta: '4ª rev.', quinta: '5ª rev.',
  d1: 'D1', d7: 'D7', d30: 'D30', d60: 'D60', manutencao: 'Manutenção',
};

export const rotuloDaEtapa = (etapa: string) => ROTULO_DA_ETAPA[etapa] ?? etapa;

/** Atrasada = revisão pendente cujo dia (em São Paulo) é anterior a hoje. */
export const revisaoAtrasada = (r: { completed: boolean; scheduled_date: string }, hoje: Dia): boolean =>
  !r.completed && diaDe(r.scheduled_date) < hoje;

export interface GrupoDeRevisoesDoDia<T> {
  dia: Dia;
  itens: T[];
  pendentes: number;
  atrasadas: number;
  concluidas: number;
  alunos: number;
}

/** Agrupa revisões por dia (em São Paulo) para a faixa diária e para a visão de revisões sem horas artificiais. */
export function agruparRevisoesPorDia<T extends { scheduled_date: string; completed: boolean; student_id: string }>(
  revisoes: T[], dias: Dia[], hoje: Dia,
): Map<Dia, GrupoDeRevisoesDoDia<T>> {
  const mapa = new Map<Dia, GrupoDeRevisoesDoDia<T>>();
  const alunosPorDia = new Map<Dia, Set<string>>();
  for (const d of dias) {
    mapa.set(d, { dia: d, itens: [], pendentes: 0, atrasadas: 0, concluidas: 0, alunos: 0 });
    alunosPorDia.set(d, new Set());
  }
  for (const r of revisoes) {
    const d = diaDe(r.scheduled_date);
    const g = mapa.get(d);
    if (!g) continue;
    g.itens.push(r);
    if (r.completed) g.concluidas++;
    else {
      g.pendentes++;
      if (d < hoje) g.atrasadas++;
    }
    alunosPorDia.get(d)!.add(r.student_id);
  }
  for (const [d, g] of mapa) {
    g.alunos = alunosPorDia.get(d)!.size;
    // Atrasadas e pendentes primeiro; concluídas por último.
    g.itens.sort((a, b) => Number(a.completed) - Number(b.completed) || a.scheduled_date.localeCompare(b.scheduled_date));
  }
  return mapa;
}

const normalizarTexto = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Filtra revisões por nome do aluno, tema ou grande área (sem diferenciar acentos ou caixa). */
export function filtrarRevisoes<T extends { student_name?: string; theme_name: string; category_name?: string | null }>(
  revisoes: T[], busca: string,
): T[] {
  const termo = normalizarTexto(busca.trim());
  if (!termo) return revisoes;
  return revisoes.filter(r =>
    normalizarTexto(r.theme_name).includes(termo)
    || normalizarTexto(r.student_name ?? '').includes(termo)
    || normalizarTexto(r.category_name ?? '').includes(termo),
  );
}

export function corDoTipo(tipo: TipoDeEvento, cor?: string | null, etapa?: string): Cor {
  if (cor && (CORES as readonly string[]).includes(cor)) return cor as Cor;
  if (tipo === 'revisao') return COR_DA_ETAPA[etapa ?? ''] ?? 'cinza';
  return tipo === 'contato' ? 'azul' : 'verde';
}

export interface Posicao { id: string; topo: number; altura: number; coluna: number; colunas: number }

/**
 * Posição vertical (em minutos) e coluna de cada evento de UM dia, no estilo do Google Calendar:
 * eventos que se sobrepõem dividem a largura; os que não se tocam ocupam a largura toda.
 */
export function posicionar(eventos: { id: string; inicioMin: number; duracaoMin: number }[], alturaMinima = 20): Posicao[] {
  const itens = eventos
    .map(e => ({ id: e.id, inicio: e.inicioMin, fim: e.inicioMin + Math.max(e.duracaoMin, alturaMinima) }))
    .sort((a, b) => a.inicio - b.inicio || b.fim - a.fim || a.id.localeCompare(b.id));
  const saida: Posicao[] = [];
  let grupo: { id: string; inicio: number; fim: number; coluna: number }[] = [];
  let fimDoGrupo = -1;
  const fechar = () => {
    const colunas = grupo.reduce((m, e) => Math.max(m, e.coluna + 1), 0);
    for (const e of grupo) saida.push({ id: e.id, topo: e.inicio, altura: e.fim - e.inicio, coluna: e.coluna, colunas });
    grupo = [];
  };
  for (const e of itens) {
    if (grupo.length && e.inicio >= fimDoGrupo) { fechar(); fimDoGrupo = -1; }
    // A primeira coluna do grupo onde o evento cabe sem encostar em outro.
    const ocupadas = new Set(grupo.filter(g => g.fim > e.inicio).map(g => g.coluna));
    let coluna = 0; while (ocupadas.has(coluna)) coluna++;
    grupo.push({ ...e, coluna });
    fimDoGrupo = Math.max(fimDoGrupo, e.fim);
  }
  if (grupo.length) fechar();
  return saida;
}

/** Eventos de um dia, ordenados por horário. */
export const eventosDoDia = <T,>(eventos: EventoDoCalendario<T>[], dia: Dia) => eventos.filter(e => diaDe(e.inicio) === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));

/** O período (ISO UTC) que cobre os dias exibidos: do começo do primeiro ao começo do dia seguinte ao último. */
export const periodoDosDias = (dias: Dia[]) => ({ de: paraIso(dias[0]!, 0), ate: paraIso(somarDias(dias[dias.length - 1]!, 1), 0) });

// -- campos de formulário (datetime-local) no fuso de São Paulo -----------------------------

/** O valor de um `<input type="datetime-local">` para um instante, na hora de São Paulo. */
export const paraCampoSP = (iso: string | Date): string => `${diaDe(iso)}T${horaDoMinuto(minutoNoDia(iso))}`;

/** O instante (ISO UTC) de um valor de `<input type="datetime-local">` lido como hora de São Paulo; `null` se vazio ou inválido. */
export function doCampoSP(valor: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(valor);
  if (!m) return null;
  return paraIso(m[1]!, Number(m[2]) * 60 + Number(m[3]));
}
