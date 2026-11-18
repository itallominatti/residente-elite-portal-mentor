import { lazy, Suspense } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Avatar, Btn, ErrorBox, Loading, SituacaoPill, Tabs } from '@/components/ui';
import { UltimaConversa } from '@/components/Carteira';
import SemPermissao from '@/pages/SemPermissao';
import { useCarteira } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { abrirConversa } from '@/lib/api/chat';
import { haQuanto } from '@/lib/format';
import type { Mentorando } from '@/lib/carteira';
import { FEATURES } from '@/config';

const Geral = lazy(() => import('@/pages/perfil/Geral'));
const Desempenho = lazy(() => import('@/pages/perfil/Desempenho'));
const Estudo = lazy(() => import('@/pages/perfil/Estudo'));
const Plano = lazy(() => import('@/pages/perfil/Plano'));
const Contatos = lazy(() => import('@/pages/perfil/Contatos'));

const ABAS = [
  { chave: 'geral', rotulo: 'Visão geral', sufixo: '' },
  { chave: 'desempenho', rotulo: 'Desempenho', sufixo: '/desempenho' },
  { chave: 'estudo', rotulo: 'Estudo', sufixo: '/estudo' },
  { chave: 'plano', rotulo: 'Plano e metas', sufixo: '/plano' },
  { chave: 'contatos', rotulo: 'Contatos e notas', sufixo: '/contatos' },
] as const;

/** A aba de contatos depende do servidor novo: com a função desligada, ela some (e o endereço volta à visão geral). */
const abasVisiveis = () => ABAS.filter(a => a.chave !== 'contatos' || FEATURES.acompanhamento);

export default function PerfilPage() {
  const { id = '', aba } = useParams();
  const { mentorandos, isLoading, error, refetch, pronto } = useCarteira();
  const m = mentorandos.find(x => x.id === id);

  if (isLoading) return <Shell title="Mentorando" back="/mentorandos"><Loading /></Shell>;
  if (error) return <Shell title="Mentorando" back="/mentorandos"><ErrorBox error={error} onRetry={refetch} /></Shell>;
  // Fora da carteira: nem o nome aparece. O servidor também recusa (403).
  if (pronto && !m) return <SemPermissao />;
  if (!m) return null;
  // Endereço de aba que não existe volta à visão geral, sem tela de erro.
  if (aba && !abasVisiveis().some(a => a.chave === aba && a.chave !== 'geral')) return <Navigate to={`/mentorandos/${id}`} replace />;
  return <Perfil m={m} aba={(aba ?? 'geral') as (typeof ABAS)[number]['chave']} />;
}

function Perfil({ m, aba }: { m: Mentorando; aba: (typeof ABAS)[number]['chave'] }) {
  const { somenteLeitura } = useEscopo();
  const nav = useNavigate();
  const qc = useQueryClient();
  const abrir = useMutation({
    mutationFn: () => abrirConversa(m.id),
    onSuccess: c => { qc.invalidateQueries({ queryKey: ['conversas'] }); nav(`/conversas/${c.id}`); },
  });
  const conversar = () => (m.conversaId ? nav(`/conversas/${m.conversaId}`) : abrir.mutate());
  const abas = abasVisiveis();
  const atual = abas.findIndex(a => a.chave === aba);

  return (
    <Shell title={m.nome} back="/mentorandos" sub={<SituacaoPill s={m.situacao} />}>
      <div className="card phead">
        <Avatar nome={m.nome} id={m.id} size={56} status={m.situacao} />
        <div className="phead-t">
          <div className="hrow wrap"><h1 className="t-h1">{m.nome}</h1><SituacaoPill s={m.situacao} /></div>
          <p className="t-small muted">{m.email} · mentoria: {m.mentores.join(', ') || '—'}</p>
          <p className="t-small"><UltimaConversa m={m} />{m.esperandoDesde && <b className="c-amber"> · esperando resposta {haQuanto(m.esperandoDesde)}</b>}</p>
        </div>
        <div className="phead-a">
          {(m.conversaId || (!somenteLeitura && m.podeEscrever)) && <Btn icon={MessageSquare} onClick={conversar} disabled={abrir.isPending}>{somenteLeitura ? 'Ler a conversa' : 'Conversar'}</Btn>}
        </div>
      </div>
      {abrir.error && <ErrorBox error={abrir.error} />}
      <Tabs on={atual} items={abas.map(a => ({ label: a.rotulo, to: `/mentorandos/${m.id}${a.sufixo}` }))} />
      <Suspense fallback={<Loading />}>
        {aba === 'geral' && <Geral m={m} />}
        {aba === 'desempenho' && <Desempenho alunoId={m.id} />}
        {aba === 'estudo' && <Estudo alunoId={m.id} />}
        {aba === 'plano' && <Plano alunoId={m.id} />}
        {aba === 'contatos' && <Contatos m={m} />}
      </Suspense>
    </Shell>
  );
}
