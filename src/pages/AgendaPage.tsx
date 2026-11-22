import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, Link2, MessageSquare, Plus, Trash2, Video } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Sheet } from '@/components/Sheet';
import { Btn, Callout, Card, Empty, ErrorBox, Loading, PageHead, Pill } from '@/components/ui';
import { useCarteira } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import {
  cancelarConviteMeet, CANAIS, criarPendencia, desconectarGoogle, DURACOES_DO_MEET, enviarConviteMeet, excluirPendencia, getGoogle,
  iniciarConexaoGoogle, listarPendencias, marcarPendencia, rotuloDoCanal, type Canal, type Pendencia, type StatusDoGoogle,
} from '@/lib/api/acompanhamento';
import { montarAgenda, ROTULO_DO_GRUPO } from '@/lib/agenda';
import { dataHora } from '@/lib/format';

/** O convite do Meet só existe para contato agendado, no futuro, ligado a um aluno e ainda aberto. */
const podeConvidar = (x: Pendencia) => x.kind === 'contato' && !!x.student_id && !!x.due_at && !x.done_at && !x.meet_url && new Date(x.due_at).getTime() > Date.now();

export default function AgendaPage() {
  const { somenteLeitura } = useEscopo();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [mostrarFeitas, setMostrarFeitas] = useState(false);
  const q = useQuery({ queryKey: ['pendencias'], queryFn: () => listarPendencias(), refetchInterval: 120_000 });
  const google = useQuery({ queryKey: ['google'], queryFn: getGoogle, retry: false, staleTime: 60_000 });
  const atualizar = () => qc.invalidateQueries({ queryKey: ['pendencias'] });
  const marcar = useMutation({ mutationFn: (v: { id: string; feita: boolean }) => marcarPendencia(v.id, v.feita), onSuccess: atualizar });
  const apagar = useMutation({ mutationFn: (id: string) => excluirPendencia(id), onSuccess: atualizar });
  const convidar = useMutation({ mutationFn: (id: string) => enviarConviteMeet(id), onSuccess: atualizar });
  const cancelar = useMutation({ mutationFn: (id: string) => cancelarConviteMeet(id), onSuccess: atualizar });
  const agenda = useMemo(() => montarAgenda(q.data ?? []), [q.data]);
  const conectado = google.data?.enabled === true && google.data.connected;

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

  return (
    <Shell title="Agenda" sub={q.data ? `${agenda.abertas} em aberto` : undefined}>
      <PageHead title="Agenda e pendências" sub="Os combinados dos seus contatos e o que você precisa fazer. Só você vê esta lista." right={<Btn icon={Plus} onClick={() => setNovo(true)} locked={somenteLeitura}>Nova pendência</Btn>} />
      <CartaoDoGoogle status={google.data} carregando={google.isLoading} somenteLeitura={somenteLeitura} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (
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
      )}
      {novo && <NovaPendencia fechar={() => setNovo(false)} google={google.data} />}
    </Shell>
  );
}

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

const paraCampo = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function NovaPendencia({ fechar, google }: { fechar: () => void; google?: StatusDoGoogle }) {
  const qc = useQueryClient();
  const { mentorandos } = useCarteira();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'tarefa' | 'contato'>('tarefa');
  const [aluno, setAluno] = useState('');
  const [quando, setQuando] = useState('');
  const [canal, setCanal] = useState<Canal>('video');
  const [convite, setConvite] = useState(false);
  const [duracao, setDuracao] = useState<number>(45);
  const [aviso, setAviso] = useState<string | null>(null);
  const podeConvite = tipo === 'contato' && !!aluno && !!quando && google?.enabled === true && google.connected;
  const salvar = useMutation({
    mutationFn: () => criarPendencia({
      titulo: titulo.trim(), tipo, aluno_id: aluno || null, para_quando: quando ? new Date(quando).toISOString() : null, canal: tipo === 'contato' ? canal : null,
      ...(convite && podeConvite ? { convite_meet: true, duracao_min: duracao } : {}),
    }),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['pendencias'] });
      // O contato foi salvo; se o Google falhou, o mentor vê por quê e refaz pela agenda, sem perder o que escreveu.
      if (r.convite?.erro) { setAviso(`O contato foi salvo, mas o convite não saiu: ${r.convite.erro} Você pode enviar depois pela agenda.`); return; }
      fechar();
    },
  });
  const valido = !!titulo.trim() && (tipo === 'tarefa' || !!quando);
  const ordenados = useMemo(() => [...mentorandos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [mentorandos]);
  if (aviso) {
    return (
      <Sheet titulo="Contato salvo" fechar={fechar} aoEnviar={fechar} enviar="Entendi">
        <Callout icon={Link2} tone="amber"><p className="t-small">{aviso}</p></Callout>
      </Sheet>
    );
  }
  return (
    <Sheet titulo="Nova pendência" fechar={fechar} aoEnviar={() => salvar.mutate()} enviar="Salvar" enviando={salvar.isPending} desabilitado={!valido} erro={salvar.error}>
      <label className="field"><span className="t-small-strong">Tipo</span><span className="input"><select value={tipo} onChange={e => setTipo(e.target.value as 'tarefa' | 'contato')} aria-label="Tipo"><option value="tarefa">Pendência</option><option value="contato">Contato agendado</option></select></span></label>
      <label className="field"><span className="t-small-strong">O que fazer</span><span className="input"><input required maxLength={160} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tipo === 'contato' ? 'Ex.: conversa sobre o plano de dezembro' : 'Ex.: montar plano de revisão'} /></span></label>
      <label className="field"><span className="t-small-strong">Aluno (opcional)</span><span className="input"><select value={aluno} onChange={e => setAluno(e.target.value)} aria-label="Aluno"><option value="">Nenhum</option>{ordenados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></span></label>
      <label className="field"><span className="t-small-strong">{tipo === 'contato' ? 'Quando' : 'Para quando (opcional)'}</span><span className="input"><input type="datetime-local" required={tipo === 'contato'} min={paraCampo(new Date())} value={quando} onChange={e => setQuando(e.target.value)} /></span></label>
      {tipo === 'contato' && <label className="field"><span className="t-small-strong">Canal</span><span className="input"><select value={canal} onChange={e => setCanal(e.target.value as Canal)} aria-label="Canal">{CANAIS.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}</select></span></label>}
      {tipo === 'contato' && google?.enabled && (
        google.connected
          ? (
            <div className="stack-s">
              <label className="hrow t-small"><input type="checkbox" checked={convite} disabled={!podeConvite} onChange={e => setConvite(e.target.checked)} /> Enviar convite do Google Meet para o aluno</label>
              {!podeConvite && <span className="t-small muted">Escolha o aluno e a data para poder enviar o convite.</span>}
              {convite && podeConvite && (
                <>
                  <label className="field"><span className="t-small-strong">Duração</span><span className="input"><select value={duracao} onChange={e => setDuracao(Number(e.target.value))} aria-label="Duração">{DURACOES_DO_MEET.map(d => <option key={d} value={d}>{d} minutos</option>)}</select></span></label>
                  <span className="t-small muted">O Google cria o evento na sua agenda e envia o e-mail com o link ao aluno. Só vão o horário e o e-mail dele, com um título genérico.</span>
                </>
              )}
            </div>
          )
          : <span className="t-small muted">Para enviar convite do Meet, conecte sua conta Google no topo da Agenda.</span>
      )}
    </Sheet>
  );
}
