import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ChevronDown, Clock, Search } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Avatar, Chev, ErrorBox, Loading, PageHead, SituacaoPill } from '@/components/ui';
import { CarteiraVazia, UltimaConversa } from '@/components/Carteira';
import { useCarteira } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { ordenarPorUrgencia, type Mentorando, type Situacao } from '@/lib/carteira';
import { haQuanto } from '@/lib/format';

type Filtro = 'todos' | Situacao | 'esperando';
const ORDENS = ['Situação: mais grave primeiro', 'Última conversa: mais antiga', 'Nome: A a Z'] as const;
const quando = (m: Mentorando) => m.ultimaMensagemEm ?? m.ultimaMensagemDoRamo ?? '';
const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export default function MentorandosPage() {
  const { mentorandos, contagem, isLoading, error, refetch, pronto } = useCarteira();
  const { verComo } = useEscopo();
  const [params, setParams] = useSearchParams();
  const filtro = (params.get('situacao') as Filtro) || 'todos';
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState(0);
  const nav = useNavigate();

  const visiveis = useMemo(() => {
    const t = normalizar(busca.trim());
    const l = mentorandos.filter(m => (filtro === 'todos' || (filtro === 'esperando' ? !!m.esperandoDesde : m.situacao === filtro))
      && (!t || normalizar(m.nome).includes(t) || normalizar(m.email).includes(t)));
    if (ordem === 1) return [...l].sort((a, b) => quando(a).localeCompare(quando(b)));
    if (ordem === 2) return [...l].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return ordenarPorUrgencia(l);
  }, [mentorandos, filtro, busca, ordem]);

  const chips: [Filtro, string, number][] = [['todos', 'Todos', contagem.total], ['alerta', 'Em alerta', contagem.alerta], ['atencao', 'Atenção', contagem.atencao], ['novo', 'Sem contato', contagem.novo], ['ok', 'Em dia', contagem.ok], ['esperando', 'Esperando resposta', contagem.esperando]];
  const setFiltro = (f: Filtro) => setParams(p => { const n = new URLSearchParams(p); if (f === 'todos') n.delete('situacao'); else n.set('situacao', f); return n; }, { replace: true });

  return (
    <Shell title="Mentorandos" sub={`${contagem.total} na ${verComo ? 'carteira' : 'sua carteira'}`}>
      {isLoading ? <Loading /> : error ? <ErrorBox error={error} onRetry={refetch} /> : pronto && contagem.total === 0 ? <CarteiraVazia /> : (
        <>
          <PageHead title={verComo ? `Mentorandos de ${verComo.mentorNome}` : 'Meus mentorandos'} sub="Só aparecem as pessoas vinculadas a esta carteira. Quem não está nela não é visível aqui." />
          <div className="stack-s">
            <div className="search">
              <span className="input"><Search size={16} aria-hidden /><input type="search" placeholder="Buscar por nome ou e-mail" aria-label="Buscar por nome ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} /></span>
              <span className="input d-only flex"><ArrowUpDown size={16} aria-hidden /><select aria-label="Ordenar por" value={ordem} onChange={e => setOrdem(Number(e.target.value))}>{ORDENS.map((o, i) => <option key={o} value={i}>{o}</option>)}</select><ChevronDown size={15} aria-hidden /></span>
            </div>
            <div className="chips" role="group" aria-label="Filtrar por situação">
              {chips.map(([k, l, n]) => <button key={k} type="button" className={`chip${filtro === k ? ' on' : ''}`} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}<span className="n">{n}</span></button>)}
            </div>
          </div>

          <div className="card flush d-only">
            <div className="tbl-wrap"><table className="tbl" aria-label="Mentorandos">
              <thead><tr><th>Mentorando</th><th>Situação</th><th>Motivo principal</th><th>Última conversa</th><th /></tr></thead>
              <tbody>
                {visiveis.map(m => (
                  <tr key={m.id} className="tr-link" onClick={e => { if (!(e.target as HTMLElement).closest('a')) nav(`/mentorandos/${m.id}`); }}>
                    <td><Link className="tcell-name" to={`/mentorandos/${m.id}`}><Avatar nome={m.nome} id={m.id} size={34} /><span className="row-t"><span className="t-strong">{m.nome}</span><span className="t-small muted">{m.email}</span></span></Link></td>
                    <td><SituacaoPill s={m.situacao} />{m.esperandoDesde && <div className="t-tiny c-amber" style={{ marginTop: 4 }}><Clock size={11} className="ic inline" aria-hidden /> espera {haQuanto(m.esperandoDesde)}</div>}</td>
                    <td className="t-small">{m.motivos[0] ? <>{m.motivos[0].texto}{m.motivos.length > 1 && <span className="muted"> +{m.motivos.length - 1}</span>}</> : <span className="muted">{m.situacao === 'novo' ? 'Falta o primeiro contato' : 'Sem sinais de alerta'}</span>}</td>
                    <td className="t-small"><UltimaConversa m={m} /></td>
                    <td className="r"><Chev /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {!visiveis.length && <p className="empty-row t-body muted">Nenhum mentorando com esse filtro.</p>}
          </div>

          <div className="stack-s m-only">
            {visiveis.map(m => (
              <Link key={m.id} className="mcard" to={`/mentorandos/${m.id}`}>
                <span className="hrow top"><Avatar nome={m.nome} id={m.id} size={40} status={m.situacao} /><span className="row-t"><span className="t-strong">{m.nome}</span><span className="t-small muted"><UltimaConversa m={m} /></span></span><SituacaoPill s={m.situacao} /></span>
                {m.motivos[0] && <span className="t-small">{m.motivos[0].texto}{m.motivos.length > 1 && <span className="muted"> +{m.motivos.length - 1}</span>}</span>}
                {m.esperandoDesde && <span className="t-tiny c-amber">Esperando resposta {haQuanto(m.esperandoDesde)}</span>}
              </Link>
            ))}
            {!visiveis.length && <p className="empty-row t-body muted">Nenhum mentorando com esse filtro.</p>}
          </div>
          <p className="t-small muted center" aria-live="polite">Mostrando {visiveis.length} de {contagem.total} mentorandos</p>
        </>
      )}
    </Shell>
  );
}
