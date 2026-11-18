import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CircleCheck, MessageSquare, Network, RefreshCw } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Avatar, Btn, Card, Empty, ErrorBox, ICONE_DO_MOTIVO, Loading, MotivoPill, PageHead, Pill, ROTULO_CURTO_DO_MOTIVO, SituacaoPill, Stats, Bar } from '@/components/ui';
import { CarteiraVazia } from '@/components/Carteira';
import { useArvore, useCarteira } from '@/hooks/useCarteira';
import { useAuth } from '@/contexts/AuthContext';
import { useEscopo } from '@/contexts/EscopoContext';
import { abrirConversa } from '@/lib/api/chat';
import { dataCurta, haQuanto } from '@/lib/format';
import type { Mentorando } from '@/lib/carteira';

const CODIGOS = ['sem_questoes_7d', 'meta_baixa_2_semanas', 'revisoes_atrasadas', 'queda_de_acerto', 'simulado_abandonado'];

export default function RadarPage() {
  const { mentorandos, contagem, radar, isLoading, error, refetch, pronto } = useCarteira();
  const [filtro, setFiltro] = useState<string | null>(null);
  const emRisco = useMemo(() => mentorandos.filter(m => m.motivos.length), [mentorandos]);
  const visiveis = filtro ? emRisco.filter(m => m.motivos.some(x => x.codigo === filtro)) : emRisco;
  const porMotivo = CODIGOS.map(c => [c, emRisco.filter(m => m.motivos.some(x => x.codigo === c)).length] as const);
  const maior = Math.max(1, ...porMotivo.map(([, n]) => n));

  return (
    <Shell title="Radar" sub={`${emRisco.length} com algum sinal`}>
      {isLoading ? <Loading>Carregando o radar…</Loading> : error ? <ErrorBox error={error} onRetry={refetch} /> : pronto && contagem.total === 0 ? <CarteiraVazia /> : (
        <>
          <PageHead title="Radar da carteira" sub={`${emRisco.length} de ${contagem.total} mentorandos com algum sinal${radar?.geradoEm ? ` · calculado ${haQuanto(radar.geradoEm)}` : ''}`} right={<Btn kind="s" icon={RefreshCw} onClick={() => refetch()}>Atualizar</Btn>} />
          <Stats items={[
            { label: 'Em alerta', value: contagem.alerta, tone: contagem.alerta ? 'bad' : 'ok', extra: 'dois motivos ou sem estudar' },
            { label: 'Atenção', value: contagem.atencao, tone: contagem.atencao ? 'amber' : 'ok', extra: 'um motivo' },
            { label: 'Esperando resposta', value: contagem.esperando, tone: contagem.esperando ? 'amber' : 'ok' },
            { label: 'Sem sinal', value: contagem.ok + contagem.novo, tone: 'ok' },
          ]} />
          <div className="cols-w">
            <div className="stack">
              <div className="chips" role="group" aria-label="Filtrar por motivo">
                <button type="button" className={`chip${!filtro ? ' on' : ''}`} aria-pressed={!filtro} onClick={() => setFiltro(null)}>Todos<span className="n">{emRisco.length}</span></button>
                {porMotivo.filter(([, n]) => n).map(([c, n]) => <button key={c} type="button" className={`chip${filtro === c ? ' on' : ''}`} aria-pressed={filtro === c} onClick={() => setFiltro(c)}>{ROTULO_CURTO_DO_MOTIVO[c]}<span className="n">{n}</span></button>)}
              </div>
              {visiveis.length ? visiveis.map(m => <CartaoDoRadar key={m.id} m={m} />)
                : <Card><Empty icon={CircleCheck} title="Ninguém no radar agora">Nenhum mentorando com sinal de alerta{filtro ? ' para este motivo' : ' esta semana'}. Bom momento para elogiar quem melhorou.</Empty></Card>}
            </div>
            <div className="stack">
              <Card title="Motivos mais frequentes">
                {porMotivo.map(([c, n]) => { const I = ICONE_DO_MOTIVO[c]; return (
                  <div key={c} className="metric"><div className="kv"><span className="t-small muted hrow">{I && <I size={13} aria-hidden />}{ROTULO_CURTO_DO_MOTIVO[c]}</span><span className="t-small-strong">{n}</span></div><Bar p={n / maior * 100} tone="amber" h={5} /></div>); })}
                <p className="t-small muted">Regras do servidor, determinísticas e sem IA. Um aluno pode ter mais de um motivo.</p>
              </Card>
              <MeuRamo />
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function CartaoDoRadar({ m }: { m: Mentorando }) {
  const { somenteLeitura } = useEscopo();
  const nav = useNavigate();
  const abrir = useMutation({ mutationFn: () => abrirConversa(m.id), onSuccess: c => nav(`/conversas/${c.id}`, { state: { rascunho: m.rascunho } }) });
  const tom = m.situacao === 'alerta' ? 'bad' : 'amber';
  return (
    <Card>
      <div className="hrow top wrap">
        <Avatar nome={m.nome} id={m.id} size={38} status={m.situacao} />
        <Link className="row-t" to={`/mentorandos/${m.id}`}><span className="t-strong">{m.nome}</span><span className="t-small muted">{m.email}</span></Link>
        <SituacaoPill s={m.situacao} />
      </div>
      <div className="prio-why">{m.motivos.map(x => <MotivoPill key={x.codigo} m={x} tone={tom} />)}</div>
      {m.resumo.length > 0 && <ul className="resumo-lines">{m.resumo.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      <div className="hrow wrap">
        <span className="t-small muted grow">{m.ultimaMensagemDoRamo ? `Última mensagem da mentoria: ${dataCurta(m.ultimaMensagemDoRamo)}` : 'Nenhuma mensagem da mentoria ainda.'}</span>
        {m.esperandoDesde && <Pill tone="amber">espera {haQuanto(m.esperandoDesde)}</Pill>}
        <Btn kind="s" sm to={`/mentorandos/${m.id}`}>Perfil</Btn>
        {somenteLeitura ? (m.conversaId && <Btn sm icon={MessageSquare} to={`/conversas/${m.conversaId}`}>Ler conversa</Btn>)
          : m.podeEscrever ? <Btn sm icon={MessageSquare} onClick={() => abrir.mutate()} disabled={abrir.isPending}>Mandar mensagem</Btn>
          : <span className="t-small muted">Só quem atende o aluno escreve para ele.</span>}
      </div>
      {abrir.error && <p className="t-small c-bad" role="alert">{(abrir.error as Error).message}</p>}
    </Card>
  );
}

/** O que o mentor usava na Árvore: o próprio ramo. Promover e mover continua com o admin, no hub. */
function MeuRamo() {
  const { user } = useAuth();
  const { mentorId, verComo } = useEscopo();
  const { data } = useArvore();
  const alvo = verComo?.mentorId ?? (mentorId || user?.id);
  const ramo = data?.mentors.find(m => m.id === alvo || m.submentores.some(s => s.id === alvo));
  if (!ramo) return null;
  return (
    <Card title="Ramo" sub="antes: tela Árvore" icon={Network}>
      <div className="list">
        <div className="row"><Avatar nome={ramo.full_name} id={ramo.id} size={32} /><span className="row-t"><span className="t-strong">{ramo.full_name}</span><span className="t-small muted">Mentor · {ramo.alunos_count} alunos</span></span></div>
        {ramo.submentores.map(s => <div key={s.id} className="row"><Avatar nome={s.full_name} id={s.id} size={32} /><span className="row-t"><span className="t-strong">{s.full_name}</span><span className="t-small muted">Submentor · enxerga a mesma carteira</span></span></div>)}
      </div>
      <p className="t-small muted">Vincular, mover e promover continuam no admin-hub (Mentoria → Árvore).</p>
    </Card>
  );
}
