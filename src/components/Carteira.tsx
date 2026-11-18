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
