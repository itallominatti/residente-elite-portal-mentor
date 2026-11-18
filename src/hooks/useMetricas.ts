import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURES } from '@/config';
import { getAgendamentosPendentes, getEvolucao, getItensDoCalendario, getTemasPrioritarios } from '@/lib/api/revision';
import { atividadesDe, constancia, resumoDasRevisoes, serieSemanal } from '@/lib/metricas';
import { diaSP } from '@/lib/format';

export const SEMANAS = 12;

/** Admin sempre lê a revisão de qualquer aluno; o mentor, só depois do ajuste do back-end (chave de função). */
export function useMetricasLiberadas(): boolean {
  const { isAdmin } = useAuth();
  return isAdmin || FEATURES.metricasDoMentor;
}

/** Revisões isoladas e simulados registrados das últimas 12 semanas (a rota aceita até 93 dias; o servidor checa quem atende o aluno). */
export function useCalendario(alunoId: string) {
  const hoje = diaSP(0);
  return useQuery({ queryKey: ['calendario-84', alunoId, hoje], queryFn: () => getItensDoCalendario(alunoId, diaSP(-(SEMANAS * 7 - 1)), hoje), staleTime: 60_000 });
}

export function useEvolucao(alunoId: string) {
  const liberado = useMetricasLiberadas();
  return useQuery({ queryKey: ['evolucao-completa', alunoId], queryFn: () => getEvolucao(alunoId), enabled: liberado, staleTime: 60_000 });
}

export function useTemasPrioritarios(alunoId: string) {
  const liberado = useMetricasLiberadas();
  return useQuery({ queryKey: ['prioritarios', alunoId], queryFn: () => getTemasPrioritarios(alunoId), enabled: liberado, staleTime: 60_000 });
}

export function useAgendamentos(alunoId: string) {
  const liberado = useMetricasLiberadas();
  return useQuery({ queryKey: ['agendamentos', alunoId], queryFn: () => getAgendamentosPendentes(alunoId), enabled: liberado, staleTime: 60_000 });
}

/** Atividade das últimas 12 semanas, a série semanal e a constância, juntas. */
export function useAtividade(alunoId: string) {
  const liberado = useMetricasLiberadas();
  const cal = useCalendario(alunoId);
  const ev = useEvolucao(alunoId);
  const hoje = diaSP(0);
  const carregando = cal.isLoading || (liberado && ev.isLoading);
  const erro = cal.error ?? ev.error;
  const dados = useMemo(() => {
    if (!cal.data || (liberado && !ev.data)) return null;
    const contatos = liberado ? ev.data!.temas.flatMap(t => t.contacts) : null;
    const ats = atividadesDe(contatos, cal.data.items);
    return { ats, semanal: serieSemanal(ats, hoje, SEMANAS), constancia: constancia(ats, hoje, SEMANAS) };
  }, [cal.data, ev.data, liberado, hoje]);
  return { dados, carregando, erro, liberado, refetch: () => { cal.refetch(); ev.refetch(); } };
}

export function useResumoDasRevisoes(alunoId: string) {
  const q = useAgendamentos(alunoId);
  return { ...q, resumo: useMemo(() => (q.data ? resumoDasRevisoes(q.data, diaSP(0)) : null), [q.data]) };
}
