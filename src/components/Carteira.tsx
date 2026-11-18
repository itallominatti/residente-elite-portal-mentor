/* Peças da carteira usadas em mais de uma tela. */
import { Link } from 'react-router-dom';
import { Clock, MessageSquare, ShieldCheck, Users } from 'lucide-react';
import type { Mentorando } from '@/lib/carteira';
import { Avatar, Btn, Card, Empty, MotivoPill, Pill, SituacaoPill } from '@/components/ui';
import { haQuanto } from '@/lib/format';
import { useEscopo } from '@/contexts/EscopoContext';

export function UltimaConversa({ m }: { m: Mentorando }) {
  const quando = m.ultimaMensagemEm ?? m.ultimaMensagemDoRamo;
  return <>{quando ? `última conversa ${haQuanto(quando)}` : 'nenhuma conversa ainda'}</>;
}

/** Uma linha da fila "quem precisa de você". */
export function LinhaDePrioridade({ m }: { m: Mentorando }) {
  const { somenteLeitura } = useEscopo();
  const tom = m.situacao === 'alerta' ? 'bad' : 'amber';
  return (
    <div className="prio">
      <Link className="prio-main" to={`/mentorandos/${m.id}`}>
        <Avatar nome={m.nome} id={m.id} size={38} status={m.situacao} />
        <span className="row-t">
          <span className="t-strong">{m.nome}</span>
          <span className="t-small muted"><UltimaConversa m={m} /></span>
          {m.motivos.length > 0
            ? <span className="prio-why">{m.motivos.slice(0, 2).map(x => <MotivoPill key={x.codigo} m={x} tone={tom} />)}{m.motivos.length > 2 && <Pill tone="muted">+{m.motivos.length - 2}</Pill>}</span>
            : <span className="prio-why"><SituacaoPill s={m.situacao} /></span>}
        </span>
      </Link>
      <span className="prio-side">
        {m.esperandoDesde && <Pill tone="amber" icon={Clock}>espera {haQuanto(m.esperandoDesde)}</Pill>}
        <span className="prio-act d-only flex">
          <Btn kind="s" sm to={`/mentorandos/${m.id}`}>Perfil</Btn>
          {m.conversaId && <Btn sm icon={MessageSquare} to={`/conversas/${m.conversaId}`}>{somenteLeitura ? 'Ler' : 'Conversar'}</Btn>}
        </span>
      </span>
    </div>
  );
}

/** Carteira vazia: não ver ninguém é o comportamento certo, e a tela diz por quê. */
export function CarteiraVazia() {
  const { verComo } = useEscopo();
  return (
    <Card className="empty-hero">
      <Empty icon={Users} title={verComo ? `${verComo.mentorNome} ainda não tem mentorandos` : 'Você ainda não tem mentorandos'}>
        O portal mostra só as pessoas vinculadas {verComo ? 'a este mentor' : 'a você'}. Ninguém foi vinculado ainda, por isso não há nada para ver aqui, nem nas conversas nem no radar.
      </Empty>
      {!verComo && <p className="t-small muted">Peça ao administrador para vincular seus alunos (no admin-hub, em Mentoria → Árvore).</p>}
      <p className="t-small muted hrow" style={{ justifyContent: 'center' }}><ShieldCheck size={14} aria-hidden /> Alunos de outros mentores não aparecem aqui. É regra de privacidade, não defeito.</p>
    </Card>
  );
}

/** Acerto das duas últimas semanas, com a variação sobre as duas anteriores. Sem respostas, não inventa número. */
export function CelulaDeAcerto({ m }: { m: Mentorando }) {
  const i = m.indicadores;
  if (!i || i.acerto_recente === null) return <span className="muted t-small">{i ? 'sem respostas' : '—'}</span>;
  const v = i.variacao_do_acerto;
  return (
    <span className="t-small">
      <b className={i.acerto_recente < 55 ? 'c-bad' : i.acerto_recente < 65 ? 'c-amber' : 'c-ok'}>{i.acerto_recente}%</b>
      {v !== null && v !== 0 && <span className={v < 0 ? 'c-bad' : 'c-ok'}> {v > 0 ? '▲' : '▼'} {Math.abs(v)}</span>}
      <span className="muted"> · {i.respostas_recentes} questões</span>
    </span>
  );
}

/** Esforço da semana contra a meta combinada. */
export function CelulaDeMeta({ m }: { m: Mentorando }) {
  const i = m.indicadores;
  if (!i) return <span className="muted t-small">—</span>;
  if (i.meta_semanal === null) return <span className="muted t-small">sem meta · {i.questoes_na_semana} na semana</span>;
  const p = i.pct_da_meta ?? 0;
  return <span className="t-small"><b className={p < 50 ? 'c-bad' : p < 80 ? 'c-amber' : 'c-ok'}>{p}%</b><span className="muted"> · {i.questoes_na_semana} de {i.meta_semanal}</span></span>;
}

export function CelulaDeRevisoes({ m }: { m: Mentorando }) {
  const i = m.indicadores;
  if (!i) return <span className="muted t-small">—</span>;
  return (
    <span className="t-small">
      {i.revisoes_atrasadas > 0 ? <b className={i.revisoes_atrasadas >= 5 ? 'c-bad' : 'c-amber'}>{i.revisoes_atrasadas} atrasada{i.revisoes_atrasadas > 1 ? 's' : ''}</b> : <span className="c-ok">em dia</span>}
      {i.revisoes_de_hoje > 0 && <span className="muted"> · {i.revisoes_de_hoje} hoje</span>}
    </span>
  );
}
