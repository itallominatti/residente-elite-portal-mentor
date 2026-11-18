import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getArvore, getCarteira, getRadar } from '@/lib/api/mentoring';
import { listarConversas, ordenarPorEspera } from '@/lib/api/chat';
import { contar, montarCarteira, ordenarPorUrgencia } from '@/lib/carteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCarteiraComIndicadores } from '@/lib/api/acompanhamento';
import { FEATURES } from '@/config';

export const useArvore = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: ['arvore'], queryFn: getArvore, enabled: !!user, staleTime: 5 * 60_000 });
};

export function useConversas() {
  const { mentorId } = useEscopo();
  const q = useQuery({ queryKey: ['conversas'], queryFn: listarConversas, enabled: mentorId !== undefined, refetchInterval: 30_000 });
  const conversas = useMemo(() => {
    const todas = q.data ?? [];
    return ordenarPorEspera(mentorId ? todas.filter(c => c.mentor_id === mentorId) : todas);
  }, [q.data, mentorId]);
  return { ...q, conversas };
}

/** A carteira do escopo atual, já com situação e na ordem de urgência. */
export function useCarteira() {
  const { mentorId } = useEscopo();
  const on = mentorId !== undefined;
  const alunos = useQuery({ queryKey: ['carteira'], queryFn: getCarteira, enabled: on, staleTime: 60_000 });
  const radar = useQuery({ queryKey: ['radar'], queryFn: getRadar, enabled: on, staleTime: 5 * 60_000 });
  const conversas = useQuery({ queryKey: ['conversas'], queryFn: listarConversas, enabled: on, refetchInterval: 30_000 });
  // Acerto, meta e revisões vêm prontos do servidor. Se esta leitura falhar, a carteira continua de pé, só sem as colunas.
  const indicadores = useQuery({
    queryKey: ['carteira-indicadores', mentorId ?? null], queryFn: () => getCarteiraComIndicadores(mentorId),
    enabled: on && FEATURES.acompanhamento, staleTime: 2 * 60_000, retry: 1,
  });

  const mentorandos = useMemo(
    () => ordenarPorUrgencia(montarCarteira(alunos.data ?? [], radar.data?.alunos ?? [], conversas.data ?? [], { mentorId: mentorId ?? null }, indicadores.data ?? [])),
    [alunos.data, radar.data, conversas.data, mentorId, indicadores.data],
  );
  return {
    mentorandos,
    contagem: contar(mentorandos),
    radar: radar.data,
    comIndicadores: !!indicadores.data,
    isLoading: alunos.isLoading || radar.isLoading || conversas.isLoading,
    error: alunos.error ?? radar.error ?? conversas.error,
    pronto: alunos.isSuccess && radar.isSuccess && conversas.isSuccess,
    refetch: () => Promise.all([alunos.refetch(), radar.refetch(), conversas.refetch()]),
  };
}
