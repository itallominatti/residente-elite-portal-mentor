import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarDays, CalendarPlus, Link2, List, MessageSquare, Plus, Trash2, Video } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { NovaPendencia } from '@/components/NovaPendencia';
import { PainelDoCalendario } from '@/components/PainelDoCalendario';
import { Btn, Callout, Card, Empty, ErrorBox, Loading, PageHead, Pill } from '@/components/ui';
import { useEscopo } from '@/contexts/EscopoContext';
import {
  cancelarConviteMeet, desconectarGoogle, enviarConviteMeet, excluirPendencia, getGoogle, iniciarConexaoGoogle, listarPendencias, marcarPendencia,
  rotuloDoCanal, type Pendencia, type StatusDoGoogle,
} from '@/lib/api/acompanhamento';
import { montarAgenda, ROTULO_DO_GRUPO } from '@/lib/agenda';
import { dataHora } from '@/lib/format';

/** O convite do Meet só existe para contato agendado, no futuro, ligado a um aluno e ainda aberto. */
const podeConvidar = (x: Pendencia) => x.kind === 'contato' && !!x.student_id && !!x.due_at && !x.done_at && !x.meet_url && new Date(x.due_at).getTime() > Date.now();

type Visao = 'calendario' | 'lista';
const guardado = (): Visao => { try { return localStorage.getItem('agenda_visao') === 'lista' ? 'lista' : 'calendario'; } catch { return 'calendario'; } };

export default function AgendaPage() {
  const { somenteLeitura, verComo } = useEscopo();
  const [visao, setVisao] = useState<Visao>(guardado);
  const [novo, setNovo] = useState(false);
  const google = useQuery({ queryKey: ['google'], queryFn: getGoogle, retry: false, staleTime: 60_000 });
  // A conta Google é de quem a conectou: em "ver como" nem aparece, e nada de convite.
  const googleDoMentor = verComo ? undefined : google.data;
  const escolher = (v: Visao) => { setVisao(v); try { localStorage.setItem('agenda_visao', v); } catch { /* sem storage */ } };

  return (
    <Shell title="Agenda">
      <PageHead
        title={verComo ? `Agenda de ${verComo.mentorNome}` : 'Agenda'}
        sub={verComo ? 'Somente leitura. Esta consulta fica registrada na auditoria do “ver como”.' : 'Seus compromissos ficam nos horários; as revisões dos alunos ficam resumidas no topo de cada dia.'}
        right={<>
          <div className="cal-seg" role="group" aria-label="Forma de ver a agenda">
            <button type="button" className={visao === 'calendario' ? 'on' : ''} aria-pressed={visao === 'calendario'} onClick={() => escolher('calendario')}><CalendarDays size={14} aria-hidden style={{ verticalAlign: -2 }} /> Calendário</button>
            <button type="button" className={visao === 'lista' ? 'on' : ''} aria-pressed={visao === 'lista'} onClick={() => escolher('lista')}><List size={14} aria-hidden style={{ verticalAlign: -2 }} /> Lista</button>
          </div>
          <Btn icon={Plus} onClick={() => setNovo(true)} locked={somenteLeitura}>Nova pendência</Btn>
        </>}
      />
      {visao === 'calendario'
        ? <PainelDoCalendario comPendencias mentorId={verComo?.mentorId} somenteLeitura={somenteLeitura} google={googleDoMentor} />
        : <ListaDaAgenda somenteLeitura={somenteLeitura} mentorId={verComo?.mentorId} conectado={!verComo && google.data?.enabled === true && google.data.connected} />}
      {!verComo && <CartaoDoGoogle status={google.data} carregando={google.isLoading} somenteLeitura={somenteLeitura} />}
      {novo && <NovaPendencia fechar={() => setNovo(false)} google={googleDoMentor} />}
    </Shell>
  );
}

// -- a lista (como era antes do calendário) ------------------------------------------------

function ListaDaAgenda({ somenteLeitura, mentorId, conectado }: { somenteLeitura: boolean; mentorId?: string; conectado: boolean }) {
  const qc = useQueryClient();
  const [mostrarFeitas, setMostrarFeitas] = useState(false);
  const q = useQuery({ queryKey: ['pendencias', mentorId ?? 'eu'], queryFn: () => listarPendencias({ mentorId }), refetchInterval: 120_000 });
  const atualizar = () => qc.invalidateQueries({ queryKey: ['pendencias'] });
  const marcar = useMutation({ mutationFn: (v: { id: string; feita: boolean }) => marcarPendencia(v.id, v.feita), onSuccess: atualizar });
  const apagar = useMutation({ mutationFn: (id: string) => excluirPendencia(id), onSuccess: atualizar });
  const convidar = useMutation({ mutationFn: (id: string) => enviarConviteMeet(id), onSuccess: atualizar });
  const cancelar = useMutation({ mutationFn: (id: string) => cancelarConviteMeet(id), onSuccess: atualizar });
  const agenda = useMemo(() => montarAgenda(q.data ?? []), [q.data]);

  const linha = (x: Pendencia) => (
    <div key={x.id} className={`pend${x.done_at ? ' feita' : ''}`}>
      <input type="checkbox" checked={!!x.done_at} disabled={somenteLeitura || marcar.isPending} onChange={e => marcar.mutate({ id: x.id, feita: e.target.checked })} aria-label={`${x.done_at ? 'Reabrir' : 'Concluir'}: ${x.title}`} />
      <span className="row-t grow">
        <span className="t-strong">{x.title}</span>
        <span className="t-small muted">
          {x.due_at ? dataHora(x.due_at) : 'sem data'}
          {x.student_id && <> · <Link to={`/mentorandos/${x.student_id}/contatos`}>{x.student_name}</Link></>}
          {x.kind === 'contato' && x.channel && <> · {rotuloDoCanal(x.channel)}</>}
        </span>
        {x.meet_url && (
          <span className="hrow wrap t-small">
            <a className="hrow" href={x.meet_url} target="_blank" rel="noreferrer"><Video size={14} aria-hidden /> Entrar no Meet</a>
            <span className="muted">· convite enviado ao aluno</span>
            {!somenteLeitura && !x.done_at && <button type="button" className="btn btn-g sm" onClick={() => { if (window.confirm('Cancelar o convite? O aluno recebe o aviso de cancelamento do Google.')) cancelar.mutate(x.id); }} disabled={cancelar.isPending}><span>Cancelar convite</span></button>}
          </span>
        )}
        {!x.meet_url && conectado && !somenteLeitura && podeConvidar(x) && (
          <span className="hrow wrap t-small"><button type="button" className="btn btn-s sm" onClick={() => { if (window.confirm(`Enviar um convite do Google Meet para ${x.student_name ?? 'o aluno'}? O Google manda o e-mail com o link.`)) convidar.mutate(x.id); }} disabled={convidar.isPending}><CalendarPlus size={14} aria-hidden /><span>Enviar convite do Meet</span></button></span>
        )}
      </span>
      {x.kind === 'contato' && <Pill tone="blue" icon={MessageSquare}>Contato</Pill>}
      {!somenteLeitura && <button type="button" className="ibtn plain" aria-label={`Apagar: ${x.title}`} onClick={() => { if (window.confirm(x.meet_url ? 'Apagar este item? O convite do Meet será cancelado e o aluno avisado.' : 'Apagar este item da agenda?')) apagar.mutate(x.id); }}><Trash2 size={16} aria-hidden /></button>}
    </div>
  );

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return (
    <>
      {!agenda.grupos.length && <Card><Empty icon={CalendarClock} title="Nada na agenda">Os próximos passos e os contatos que você agendar ao registrar um contato aparecem aqui.</Empty></Card>}
      {agenda.grupos.map(g => (
        <Card key={g.grupo} title={ROTULO_DO_GRUPO[g.grupo]} sub={`${g.itens.length}`} icon={CalendarClock} iconTone={g.grupo === 'atrasadas' ? 'bad' : g.grupo === 'hoje' ? 'amber' : 'teal'}>
          <div className="agenda-grupo">{g.itens.map(linha)}</div>
        </Card>
      ))}
      {agenda.feitas.length > 0 && (
        <Card title="Concluídas" sub={`${agenda.feitas.length}`} right={<Btn kind="g" sm onClick={() => setMostrarFeitas(v => !v)}>{mostrarFeitas ? 'Ocultar' : 'Mostrar'}</Btn>}>
          {mostrarFeitas && <div className="agenda-grupo">{agenda.feitas.slice(0, 30).map(linha)}</div>}
        </Card>
      )}
      {(marcar.error || apagar.error || convidar.error || cancelar.error) && <p className="t-small c-bad" role="alert">{((marcar.error ?? apagar.error ?? convidar.error ?? cancelar.error) as Error).message}</p>}
    </>
  );
}

// -- conta Google ---------------------------------------------------------------------------

/** Conectar a conta Google (para enviar convites do Meet). Só aparece se o servidor tem a integração ligada. */
function CartaoDoGoogle({ status, carregando, somenteLeitura }: { status?: StatusDoGoogle; carregando: boolean; somenteLeitura: boolean }) {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const retorno = params.get('google');
  // O aviso do retorno do Google vale uma vez: limpa o endereço para não reaparecer ao recarregar.
  useEffect(() => { if (retorno) { qc.invalidateQueries({ queryKey: ['google'] }); const n = new URLSearchParams(params); n.delete('google'); setParams(n, { replace: true }); } }, [retorno]); // eslint-disable-line react-hooks/exhaustive-deps
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => { if (retorno === 'conectado') setAviso('Conta Google conectada. Já dá para enviar convites do Meet.'); else if (retorno === 'negado') setAviso('Você não autorizou o acesso. Nada foi conectado.'); else if (retorno) setAviso('Não foi possível conectar a conta Google. Tente de novo.'); }, [retorno]);

  const conectar = useMutation({ mutationFn: iniciarConexaoGoogle, onSuccess: url => window.location.assign(url) });
  const desconectar = useMutation({ mutationFn: desconectarGoogle, onSuccess: () => qc.invalidateQueries({ queryKey: ['google'] }) });
  if (carregando || !status?.enabled) return aviso ? <Callout icon={Link2} tone="amber"><p className="t-small">{aviso}</p></Callout> : null;
  return (
    <>
      {aviso && <Callout icon={Link2} tone={retorno === 'conectado' ? 'ok' : 'amber'}><p className="t-small">{aviso}</p></Callout>}
      <Card title="Convite do Google Meet" icon={Video} sub={status.connected ? 'conectado' : 'não conectado'}>
        {status.connected ? (
          <>
            <p className="t-small">Conta conectada: <b>{status.google_email}</b>. Ao agendar um contato você escolhe se envia o convite. O evento nasce na sua agenda do Google, com o link do Meet, e o Google avisa o aluno por e-mail.</p>
            <div className="hrow"><Btn kind="g" sm onClick={() => { if (window.confirm('Desconectar o Google? Convites já enviados continuam valendo, mas novos não saem até você conectar de novo.')) desconectar.mutate(); }} locked={somenteLeitura} disabled={desconectar.isPending}>Desconectar</Btn></div>
          </>
        ) : (
          <>
            <p className="t-small">Conecte a sua conta Google para enviar convites do Meet aos alunos ao agendar um contato. O portal só cria e altera os eventos dos convites; não lê o resto da sua agenda. Você escolhe, contato a contato, se envia. O e-mail do aluno é enviado ao Google para ele receber o convite.</p>
            <div className="hrow"><Btn icon={Link2} onClick={() => conectar.mutate()} locked={somenteLeitura} disabled={conectar.isPending}>Conectar conta Google</Btn></div>
          </>
        )}
        {(conectar.error || desconectar.error) && <p className="t-small c-bad" role="alert">{((conectar.error ?? desconectar.error) as Error).message}</p>}
      </Card>
    </>
  );
}
