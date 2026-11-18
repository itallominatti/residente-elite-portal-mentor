/**
 * Agenda do mentor: separa as pendências e os contatos agendados em grupos por
 * prazo, no fuso de São Paulo. Função pura (a tela só mostra).
 */
import type { Pendencia } from '@/lib/api/acompanhamento';
import { FUSO } from '@/config';

export type GrupoDaAgenda = 'atrasadas' | 'hoje' | 'proximos7' | 'depois' | 'sem_data';
export const ROTULO_DO_GRUPO: Record<GrupoDaAgenda, string> = {
  atrasadas: 'Atrasadas', hoje: 'Hoje', proximos7: 'Próximos 7 dias', depois: 'Mais adiante', sem_data: 'Sem data',
};
export const ORDEM_DOS_GRUPOS: GrupoDaAgenda[] = ['atrasadas', 'hoje', 'proximos7', 'depois', 'sem_data'];

/** `yyyy-MM-dd` em São Paulo. */
export const diaEmSP = (d: Date | string | number) => new Date(d).toLocaleDateString('en-CA', { timeZone: FUSO });

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function grupoDe(p: Pendencia, agora: number): GrupoDaAgenda {
  if (!p.due_at) return 'sem_data';
  const hoje = diaEmSP(agora), dia = diaEmSP(p.due_at);
  if (dia < hoje) return 'atrasadas';
  if (dia === hoje) return 'hoje';
  return diasEntre(hoje, dia) <= 7 ? 'proximos7' : 'depois';
}

export interface Agenda { grupos: { grupo: GrupoDaAgenda; itens: Pendencia[] }[]; feitas: Pendencia[]; abertas: number }

export function montarAgenda(pendencias: Pendencia[], agora = Date.now()): Agenda {
  const abertas = pendencias.filter(p => !p.done_at);
  const feitas = pendencias.filter(p => p.done_at).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  const grupos = ORDEM_DOS_GRUPOS.map(grupo => ({
    grupo,
    itens: abertas.filter(p => grupoDe(p, agora) === grupo).sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999') || a.title.localeCompare(b.title, 'pt-BR')),
  })).filter(g => g.itens.length);
  return { grupos, feitas, abertas: abertas.length };
}

/** Quantas pedem atenção agora: atrasadas e as de hoje (o selo do menu). */
export function pedemAtencao(pendencias: Pendencia[], agora = Date.now()): number {
  return pendencias.filter(p => !p.done_at && ['atrasadas', 'hoje'].includes(grupoDe(p, agora))).length;
}
