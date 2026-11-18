import { Link } from 'react-router-dom';
import { Clock, MessageSquare, Radar } from 'lucide-react';
import { Shell, useNomeDoUsuario } from '@/components/Shell';
import { Avatar, Btn, Card, ErrorBox, Loading, PageHead, Pill, Stats } from '@/components/ui';
import { CarteiraVazia, LinhaDePrioridade } from '@/components/Carteira';
import { useCarteira } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { haQuanto, hojeLongo, saudacao } from '@/lib/format';

export default function InicioPage() {
  const { mentorandos, contagem, radar, isLoading, error, refetch, pronto } = useCarteira();
  const { verComo } = useEscopo();
  const nome = useNomeDoUsuario();
  const primeiro = verComo ? verComo.mentorNome : nome.split(' ').slice(0, 2).join(' ');
  const fila = mentorandos.filter(m => m.situacao !== 'ok').slice(0, 6);
  const esperando = mentorandos.filter(m => m.esperandoDesde).sort((a, b) => (a.esperandoDesde ?? '').localeCompare(b.esperandoDesde ?? ''));
  const risco = contagem.alerta + contagem.atencao;

  return (
    <Shell title="Início" sub={hojeLongo()}>
      {isLoading ? <Loading>Montando sua carteira…</Loading> : error ? <ErrorBox error={error} onRetry={refetch} /> : pronto && contagem.total === 0 ? <CarteiraVazia /> : (
        <>
          <PageHead
            title={verComo ? `Início de ${primeiro}` : `${saudacao()}, ${primeiro}`}
            sub={`${risco} de ${contagem.total} mentorandos pedem atenção. ${contagem.esperando === 1 ? 'Uma pessoa está' : `${contagem.esperando} pessoas estão`} esperando resposta.`}
            right={<Btn icon={Radar} to="/radar">Ver o radar</Btn>}
          />
          <Stats items={[
            { label: 'Esperando resposta', value: contagem.esperando, tone: contagem.esperando ? 'bad' : 'ok', to: '/conversas', extra: esperando[0] ? `a mais antiga: ${haQuanto(esperando[0].esperandoDesde)}` : 'ninguém esperando' },
            { label: 'Em alerta', value: contagem.alerta, tone: contagem.alerta ? 'bad' : 'ok', to: '/mentorandos?situacao=alerta' },
            { label: 'Atenção', value: contagem.atencao, tone: contagem.atencao ? 'amber' : 'ok', to: '/mentorandos?situacao=atencao' },
            { label: 'Sem primeiro contato', value: contagem.novo, tone: contagem.novo ? 'blue' : 'ok', to: '/mentorandos?situacao=novo' },
          ]} />
          <div className="cols">
            <Card title="Quem precisa de você hoje" sub="ordenado pelo radar e pela espera" right={<Link className="link" to="/radar">Abrir o radar</Link>} flush>
              {fila.length ? <div className="prio-list">{fila.map(m => <LinhaDePrioridade key={m.id} m={m} />)}</div>
                : <p className="t-body muted" style={{ padding: '4px 16px 18px' }}>Nenhum mentorando com sinal de alerta agora. Bom momento para elogiar quem está em dia.</p>}
            </Card>
            <div className="stack">
              <Card title="Esperando resposta" sub={`${esperando.length}`} icon={Clock} iconTone="amber" right={<Link className="link" to="/conversas">Conversas</Link>}>
                {esperando.length ? <div className="list">{esperando.slice(0, 5).map(m => (
                  <Link key={m.id} className="row" to={m.conversaId ? `/conversas/${m.conversaId}` : `/mentorandos/${m.id}`}>
                    <Avatar nome={m.nome} id={m.id} size={32} status={m.situacao} />
                    <span className="row-t"><span className="t-strong">{m.nome}</span><span className="t-small muted trunc">{m.previa || 'nova mensagem'}</span></span>
                    <Pill tone="amber">{haQuanto(m.esperandoDesde)}</Pill>
                  </Link>))}</div>
                  : <p className="t-small muted">Ninguém esperando. Tudo respondido.</p>}
              </Card>
              <Card title="Sobre estes números" icon={MessageSquare} iconTone="muted">
                <p className="t-small muted">A situação vem das 5 regras do radar, calculadas pelo servidor{radar?.geradoEm ? ` (atualizado ${haQuanto(radar.geradoEm)})` : ''}. “Esperando” é conversa cuja última mensagem é do aluno.</p>
              </Card>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
