import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownWideNarrow, Eye, FileText, Lock, MessageSquare, Search, Send, User } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Avatar, Btn, Callout, Empty, ErrorBox, Loading, MotivoPill, SituacaoPill } from '@/components/ui';
import { CarteiraVazia } from '@/components/Carteira';
import { useCarteira, useConversas } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { useAuth } from '@/contexts/AuthContext';
import { enviarMensagem, listarMensagens, marcarLida, type Conversa, type Mensagem } from '@/lib/api/chat';
import { dataCurta, haQuanto } from '@/lib/format';
import { FUSO } from '@/config';

const POLL_MS = 5000;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });

export default function ConversasPage() {
  const { threadId } = useParams();
  const { conversas, isLoading, error, refetch } = useConversas();
  const { contagem, pronto, mentorandos } = useCarteira();
  const [busca, setBusca] = useState('');
  const [injetar, setInjetar] = useState<{ texto: string; conversaId: string } | null>(null);
  const ativa = conversas.find(c => c.id === threadId) ?? null;
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? conversas.filter(c => c.student_name.toLowerCase().includes(t)) : conversas;
  }, [conversas, busca]);
  const aguardando = conversas.filter(c => c.id && c.last_message_author_is_student).length;
  const comConversa = filtradas.filter(c => c.id);
  // O servidor só lista como "a iniciar" os alunos do PRÓPRIO mentor. Para quem vê a carteira de outro
  // (o admin em "ver como") a lista completa sai da carteira: todo mentorando aparece, com ou sem conversa.
  const aIniciar = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const comThread = new Set(conversas.filter(c => c.id).map(c => c.student_id));
    const mapa = new Map<string, { student_id: string; student_name: string }>();
    for (const c of conversas) if (!c.id) mapa.set(c.student_id, c);
    for (const x of mentorandos) if (!comThread.has(x.id)) mapa.set(x.id, { student_id: x.id, student_name: x.nome });
    return [...mapa.values()].filter(c => !t || c.student_name.toLowerCase().includes(t)).sort((a, b) => a.student_name.localeCompare(b.student_name, 'pt-BR'));
  }, [conversas, mentorandos, busca]);
  const m = ativa ? mentorandos.find(x => x.id === ativa.student_id) : undefined;

  return (
    <Shell title={ativa ? ativa.student_name : 'Conversas'} back={ativa ? '/conversas' : undefined} sub={ativa ? (m ? <SituacaoPill s={m.situacao} /> : undefined) : `${aguardando} aguardando resposta`} noTabs={!!ativa}>
      {isLoading ? <Loading>Carregando conversas…</Loading> : error ? <ErrorBox error={error} onRetry={refetch} /> : pronto && contagem.total === 0 ? <CarteiraVazia /> : (
        <div className={`chat-cols ${ativa ? 'v-conversa' : 'v-lista'}`}>
          <aside className="chat-inbox" aria-label="Conversas">
            <div className="stack-s" style={{ padding: '12px 12px 4px' }}>
              <span className="input"><Search size={16} aria-hidden /><input type="search" placeholder="Buscar conversa" aria-label="Buscar conversa" value={busca} onChange={e => setBusca(e.target.value)} /></span>
              <p className="t-small muted"><ArrowDownWideNarrow size={13} className="ic inline" aria-hidden /> Quem espera há mais tempo, primeiro.</p>
            </div>
            <div className="ib-list">
              {comConversa.map(c => <ItemDaCaixa key={c.id} c={c} on={c.id === threadId} />)}
              {aIniciar.length > 0 && <><div className="grp-h" style={{ padding: '10px 14px 4px' }}><span className="t-label">Sem conversa ainda</span><span className="t-small-strong muted">{aIniciar.length}</span></div>
                {aIniciar.map(c => <Link key={c.student_id} className="ib" to={`/mentorandos/${c.student_id}`}><Avatar nome={c.student_name} id={c.student_id} size={34} /><span className="row-t"><span className="t-strong trunc">{c.student_name}</span><span className="t-small muted">abrir pelo perfil</span></span></Link>)}</>}
              {!comConversa.length && !aIniciar.length && <p className="empty-row t-small muted">Nenhuma conversa encontrada.</p>}
            </div>
          </aside>
          {ativa ? <Conversa c={ativa} key={ativa.id} injetar={injetar} /> : (
            <section className="chat-thread"><div className="chat-empty"><Empty icon={MessageSquare} title="Escolha uma conversa">À esquerda, quem espera resposta há mais tempo aparece primeiro.</Empty></div></section>
          )}
          <aside className="chat-side" aria-label="Contexto do mentorando">
            {ativa && m ? <Contexto c={ativa} onUsar={t => setInjetar({ texto: t, conversaId: ativa.id! })} /> : <p className="t-small muted">O contexto do mentorando aparece aqui quando você abre uma conversa.</p>}
          </aside>
        </div>
      )}
      {threadId && !isLoading && !error && !ativa && conversas.length > 0 && <Callout icon={Lock} tone="amber"><p className="t-small">Essa conversa não está nesta carteira.</p></Callout>}
    </Shell>
  );
}

function ItemDaCaixa({ c, on }: { c: Conversa; on: boolean }) {
  const { mentorandos } = useCarteira();
  const m = mentorandos.find(x => x.id === c.student_id);
  return (
    <Link className={`ib${on ? ' on' : ''}`} to={`/conversas/${c.id}`} aria-current={on ? 'page' : undefined}>
      <Avatar nome={c.student_name} id={c.student_id} size={38} status={m?.situacao} />
      <span className="row-t">
        <span className="hrow"><span className="t-strong trunc grow">{c.student_name}</span>{c.unread_count > 0 && <i className="unread" aria-label={`${c.unread_count} não lidas`} />}</span>
        <span className="t-small muted trunc">{c.last_message_preview || 'Sem mensagens'}</span>
        {c.last_message_author_is_student && c.last_message_at && <span className="t-tiny c-amber">esperando {haQuanto(c.last_message_at)}</span>}
      </span>
    </Link>
  );
}

function Conversa({ c, injetar }: { c: Conversa; injetar: { texto: string; conversaId: string } | null }) {
  const { user } = useAuth();
  const { somenteLeitura, verComo } = useEscopo();
  const qc = useQueryClient();
  const loc = useLocation();
  const nav = useNavigate();
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const [texto, setTexto] = useState('');
  const [deModelo, setDeModelo] = useState(false);
  const podeEscrever = !somenteLeitura && c.can_write === true;

  const msgs = useQuery({ queryKey: ['mensagens', c.id], queryFn: () => listarMensagens(c.id!), refetchInterval: POLL_MS, refetchIntervalInBackground: false });

  // Rascunho vindo do radar (estado da navegação). Lido uma vez e tirado do histórico.
  useEffect(() => {
    const r = (loc.state as { rascunho?: string } | null)?.rascunho;
    if (r && podeEscrever) { setTexto(r); setDeModelo(true); campo.current?.focus(); }
    if (r) nav(loc.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rascunho pedido pelo painel de contexto. Só vale para ESTA conversa: o
  // texto traz o nome do aluno, e levá-lo para outra conversa mandaria a um
  // aluno a mensagem de outro (o achado H1 do QA do hub).
  useEffect(() => {
    if (injetar && injetar.conversaId === c.id && podeEscrever) { setTexto(injetar.texto); setDeModelo(true); campo.current?.focus(); }
  }, [injetar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marcar como lida altera o estado da conversa: no "ver como" não marca.
  useEffect(() => {
    if (!somenteLeitura && c.id && c.unread_count > 0) marcarLida(c.id).then(() => qc.invalidateQueries({ queryKey: ['conversas'] })).catch(() => undefined);
  }, [c.id, c.unread_count, somenteLeitura, qc]);

  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs.data?.length]);

  const enviar = useMutation({
    mutationFn: (body: string) => enviarMensagem(c.id!, body),
    onSuccess: (nova: Mensagem) => {
      qc.setQueryData<Mensagem[]>(['mensagens', c.id], (a = []) => [...a, nova]);
      qc.invalidateQueries({ queryKey: ['conversas'] });
      setTexto(''); setDeModelo(false);
    },
  });
  const mandar = () => { const t = texto.trim(); if (t && podeEscrever && !enviar.isPending) enviar.mutate(t); };

  const lista = msgs.data ?? [];
  let diaAnterior = '';
  return (
    <section className="chat-thread" aria-label={`Conversa com ${c.student_name}`}>
      <header className="chat-h">
        <Avatar nome={c.student_name} id={c.student_id} size={38} />
        <span className="grow"><span className="t-strong" style={{ display: 'block' }}>{c.student_name}</span><span className="t-small muted">Mentoria: {c.mentor_name}</span></span>
        <Btn kind="s" sm icon={User} to={`/mentorandos/${c.student_id}`}>Perfil</Btn>
      </header>
      {verComo && <div className="chat-ro"><Eye size={15} aria-hidden /><span><b>Conversa privada entre {verComo.mentorNome} e {c.student_name}.</b> Você está lendo como administrador.</span></div>}
      <div className="chat-msgs" aria-live="polite">
        {msgs.isLoading ? <Loading /> : msgs.error ? <ErrorBox error={msgs.error} onRetry={() => msgs.refetch()} /> : !lista.length ? <p className="chat-empty t-small">Nenhuma mensagem ainda.</p> : lista.map(x => {
          const dia = dataCurta(x.created_at), sep = dia !== diaAnterior; diaAnterior = dia;
          const doAluno = x.author_id === c.student_id, minha = x.author_id === user?.id;
          return (
            <div key={x.id} style={{ display: 'contents' }}>
              {sep && <span className="day">{dia}</span>}
              <div className={`bubble-w${doAluno ? '' : ' me'}`}><div className="bubble">{x.body}</div><span className="meta">{minha ? 'Você' : x.author_name} · {hora(x.created_at)}</span></div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>
      {podeEscrever ? (
        <footer className="chat-f">
          {deModelo && <div className="draft-flag"><span className="pill tone-amber"><FileText size={12} aria-hidden />Rascunho de modelo do radar</span><span className="t-small muted">Revise e edite antes de enviar.</span><button type="button" className="link push" onClick={() => { setTexto(''); setDeModelo(false); }}>Descartar</button></div>}
          <div className="composer">
            <span className="input area grow"><textarea ref={campo} rows={3} placeholder="Escreva sua resposta… (Ctrl+Enter envia)" aria-label="Sua resposta" value={texto}
              onChange={e => { setTexto(e.target.value); if (!e.target.value.trim()) setDeModelo(false); }}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mandar(); } }} /></span>
            <Btn icon={Send} onClick={mandar} disabled={!texto.trim() || enviar.isPending}>Enviar</Btn>
          </div>
          {enviar.error && <p className="t-small c-bad" role="alert">{(enviar.error as Error).message}</p>}
        </footer>
      ) : (
        <div className="chat-lock"><Lock size={16} aria-hidden /><span>{somenteLeitura ? 'Somente leitura: você não pode enviar mensagens em nome do mentor.' : 'Você não atende este aluno diretamente, então só pode ler esta conversa.'}</span></div>
      )}
    </section>
  );
}

function Contexto({ c, onUsar }: { c: Conversa; onUsar: (texto: string) => void }) {
  const { mentorandos } = useCarteira();
  const { somenteLeitura } = useEscopo();
  const m = mentorandos.find(x => x.id === c.student_id);
  if (!m) return null;
  const tom = m.situacao === 'alerta' ? 'bad' : 'amber';
  const usarRascunho = () => onUsar(m.rascunho);
  return (
    <div className="stack">
      <div className="hrow"><Avatar nome={m.nome} id={m.id} size={34} status={m.situacao} /><span className="row-t"><span className="t-strong">{m.nome}</span><SituacaoPill s={m.situacao} /></span></div>
      {m.motivos.length ? <div className="prio-why">{m.motivos.map(x => <MotivoPill key={x.codigo} m={x} tone={tom} />)}</div> : <p className="t-small muted">Sem sinais de alerta no radar.</p>}
      {m.resumo.length > 0 && <div className="stack-xs"><span className="t-label">Antes da conversa</span><ul className="resumo-lines">{m.resumo.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
      {m.rascunho && !somenteLeitura && c.can_write === true && (
        <div className="stack-xs"><span className="t-label">Rascunho do radar</span><p className="t-small muted">Texto de modelo, pelo motivo mais grave. Vai para o campo; nada é enviado sem você.</p><Btn kind="s" sm icon={FileText} onClick={usarRascunho}>Usar como ponto de partida</Btn></div>
      )}
      <Btn kind="g" sm icon={User} to={`/mentorandos/${m.id}`}>Abrir o perfil completo</Btn>
    </div>
  );
}
