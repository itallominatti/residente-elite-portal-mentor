import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, Search } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Avatar, Btn, Callout, ErrorBox, Loading, PageHead } from '@/components/ui';
import { useArvore } from '@/hooks/useCarteira';
import { getRadar } from '@/lib/api/mentoring';
import { getCarteira } from '@/lib/api/mentoring';
import { listarConversas } from '@/lib/api/chat';

/**
 * Entrada do admin: os mentores e um número de "como vai o atendimento".
 * O admin já lê toda a base (alunos, radar e conversas); aqui os números são
 * recortados por mentor no navegador, sem endpoint novo.
 */
export default function MentoresPage() {
  const arvore = useArvore();
  const alunos = useQuery({ queryKey: ['carteira'], queryFn: getCarteira, staleTime: 60_000 });
  const radar = useQuery({ queryKey: ['radar'], queryFn: getRadar, staleTime: 5 * 60_000 });
  const conversas = useQuery({ queryKey: ['conversas'], queryFn: listarConversas, refetchInterval: 60_000 });
  const [busca, setBusca] = useState('');

  const linhas = useMemo(() => {
    const emRisco = new Set((radar.data?.alunos ?? []).map(a => a.id));
    return (arvore.data?.mentors ?? []).map(m => {
      const ids = new Set((alunos.data ?? []).filter(a => a.mentorships.some(v => v.mentor_id === m.id)).map(a => a.id));
      const esperando = (conversas.data ?? []).filter(c => c.mentor_id === m.id && c.id && c.last_message_author_is_student).length;
      return { ...m, total: ids.size || m.alunos_count, risco: [...ids].filter(i => emRisco.has(i)).length, esperando };
    }).filter(m => !busca.trim() || m.full_name.toLowerCase().includes(busca.trim().toLowerCase()))
      .sort((a, b) => b.esperando - a.esperando || b.risco - a.risco || a.full_name.localeCompare(b.full_name, 'pt-BR'));
  }, [arvore.data, alunos.data, radar.data, conversas.data, busca]);

  const carregando = arvore.isLoading || alunos.isLoading || radar.isLoading || conversas.isLoading;
  const erro = arvore.error ?? alunos.error ?? radar.error ?? conversas.error;

  return (
    <Shell title="Mentores">
      <PageHead title="Mentores" sub="Entre no portal de um mentor para dar suporte ou revisar o atendimento." />
      <Callout icon={Eye} tone="amber"><p className="t-strong">Você está no portal como administrador</p><p className="t-small">Você não tem carteira própria aqui. Para ver o portal de um mentor, use “Ver como”: abre somente leitura, com faixa de aviso fixa.</p></Callout>
      <div className="search"><span className="input"><Search size={16} aria-hidden /><input type="search" placeholder="Buscar mentor" aria-label="Buscar mentor" value={busca} onChange={e => setBusca(e.target.value)} /></span></div>
      {carregando ? <Loading /> : erro ? <ErrorBox error={erro} onRetry={() => { arvore.refetch(); alunos.refetch(); radar.refetch(); conversas.refetch(); }} /> : (
        <div className="card flush"><div className="tbl-wrap"><table className="tbl" aria-label="Mentores">
          <thead><tr><th>Mentor</th><th className="r">Mentorandos</th><th className="r">Em risco</th><th className="r">Aguardando resposta</th><th>Submentores</th><th /></tr></thead>
          <tbody>{linhas.map(m => (
            <tr key={m.id}>
              <td><Link className="tcell-name" to={`/admin/mentores/${m.id}`}><Avatar nome={m.full_name} id={m.id} size={34} /><span className="row-t"><span className="t-strong">{m.full_name}</span><span className="t-small muted">{m.role === 'admin' ? 'Admin e mentor' : 'Mentor'} · {m.email}</span></span></Link></td>
              <td className="r num">{m.total}</td>
              <td className={`r num${m.risco >= 8 ? ' c-bad' : ''}`}>{m.risco}</td>
              <td className={`r num${m.esperando >= 5 ? ' c-amber' : ''}`}>{m.esperando}</td>
              <td className="t-small muted">{m.submentores.map(s => s.full_name).join(', ') || '—'}</td>
              <td className="r">{m.total ? <Btn kind="s" sm icon={Eye} to={`/admin/mentores/${m.id}`}>Ver como</Btn> : <span className="t-small muted">Sem mentorandos</span>}</td>
            </tr>))}</tbody>
        </table></div>{!linhas.length && <p className="empty-row t-body muted">Nenhum mentor encontrado.</p>}</div>
      )}
      <p className="t-small muted">“Aguardando resposta” são conversas cuja última mensagem é do aluno.</p>
    </Shell>
  );
}
