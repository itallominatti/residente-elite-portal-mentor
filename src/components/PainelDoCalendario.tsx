/**
 * O calendário da agenda: pendências e contatos do mentor e as revisões agendadas dos alunos, por horário.
 *
 * Mentor: arrasta uma pendência ou uma revisão para outro dia/horário, pinta cada pendência e clica num
 * horário vazio para criar. Admin (página de revisões): vê e remarca as revisões dos alunos de qualquer
 * mentor. Em "ver como" tudo é só leitura, e o servidor também recusa a escrita.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, Info, Video } from 'lucide-react';
import { Calendario } from '@/components/Calendario';
import { NovaPendencia } from '@/components/NovaPendencia';
import { Paleta } from '@/components/Paleta';
import { Sheet } from '@/components/Sheet';
import { Btn, Callout, ErrorBox, Loading, Pill } from '@/components/ui';
import {
  atualizarPendencia, cancelarConviteMeet, enviarConviteMeet, excluirPendencia, listarPendencias, listarRevisoes, remarcarRevisao, rotuloDoCanal,
  type Pendencia, type RevisaoDoAluno, type StatusDoGoogle,
} from '@/lib/api/acompanhamento';
import {
  corDoTipo, diaDe, diasDaSemana, doCampoSP, paraCampoSP, periodoDosDias, ROTULO_DA_ETAPA, rotuloDoPeriodo, somarDias,
  type Dia, type EventoDoCalendario,
} from '@/lib/calendario';
import { dataHora } from '@/lib/format';

type Origem = { pendencia: Pendencia } | { revisao: RevisaoDoAluno };
type Evento = EventoDoCalendario<Origem>;
type Modo = 'semana' | 'dia';

const guardado = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

const DURACAO_DA_PENDENCIA_MIN = 30;
const DURACAO_DA_REVISAO_MIN = 30;

export function eventoDaPendencia(p: Pendencia, podeMexer: boolean): Evento | null {
  if (!p.due_at) return null;
  const tipo = p.kind === 'contato' ? 'contato' : 'pendencia';
  return {
    id: `p-${p.id}`, tipo, titulo: p.title, subtitulo: p.student_name ?? undefined, inicio: p.due_at,
    duracaoMin: p.kind === 'contato' ? p.meet_duration_min || 45 : DURACAO_DA_PENDENCIA_MIN,
    cor: corDoTipo(tipo, p.color), concluido: !!p.done_at, arrastavel: podeMexer && !p.done_at, origem: { pendencia: p },
  };
}

export function eventoDaRevisao(r: RevisaoDoAluno, podeMexer: boolean): Evento {
  return {
    id: `r-${r.id}`, tipo: 'revisao', titulo: r.theme_name, subtitulo: `${r.student_name} · ${ROTULO_DA_ETAPA[r.stage] ?? r.stage}`, inicio: r.scheduled_date,
    duracaoMin: DURACAO_DA_REVISAO_MIN, cor: corDoTipo('revisao', null, r.stage), concluido: r.completed, arrastavel: podeMexer && !r.completed, origem: { revisao: r },
  };
}

interface Props {
  /** `false` na página de revisões do admin: só as revisões dos alunos. */
  comPendencias: boolean;
  /** "Ver como" (o mentor visto) ou o mentor escolhido pelo admin. Sem ele, a carteira de quem está logado. */
  mentorId?: string;
  somenteLeitura: boolean;
  google?: StatusDoGoogle;
}

export function PainelDoCalendario({ comPendencias, mentorId, somenteLeitura, google }: Props) {
  const qc = useQueryClient();
  const hoje = diaDe(new Date());
  const [modo, setModo] = useState<Modo>(() => (guardado('agenda_modo') as Modo | null) ?? (typeof window !== 'undefined' && window.innerWidth < 720 ? 'dia' : 'semana'));
  const [ancora, setAncora] = useState<Dia>(hoje);
  const [verPendencias, setVerPendencias] = useState(true);
  const [verRevisoes, setVerRevisoes] = useState(true);
  const [aluno, setAluno] = useState('');
  const [nova, setNova] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Evento | null>(null);
  const [confirmar, setConfirmar] = useState<{ revisao: RevisaoDoAluno; para: string } | null>(null);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'amber' | 'bad'; texto: string } | null>(null);
  useEffect(() => { guardar('agenda_modo', modo); }, [modo]);

  const dias = useMemo(() => (modo === 'dia' ? [ancora] : diasDaSemana(ancora)), [modo, ancora]);
  const { de, ate } = periodoDosDias(dias);
  const dono = mentorId ?? 'eu';

  const pendencias = useQuery({ queryKey: ['pendencias', dono], queryFn: () => listarPendencias({ mentorId }), enabled: comPendencias, refetchInterval: 120_000 });
  const revisoes = useQuery({
    queryKey: ['revisoes', dono, de, ate, aluno || 'todos'], queryFn: () => listarRevisoes({ de, ate, mentorId, alunoId: aluno || undefined, concluidas: true }),
    enabled: verRevisoes, placeholderData: keepPreviousData, refetchInterval: 120_000,
  });
  // Os alunos do filtro são os que têm revisão na tela: quem não tem nada no período não precisa estar na lista.
  const [alunosConhecidos, setAlunosConhecidos] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!revisoes.data) return;
    setAlunosConhecidos(m => { const n = new Map(m); for (const r of revisoes.data!) n.set(r.student_id, r.student_name); return n; });
  }, [revisoes.data]);

  const podeMexer = !somenteLeitura;
  const eventos = useMemo<Evento[]>(() => {
    const lista: Evento[] = [];
    if (comPendencias && verPendencias) for (const p of pendencias.data ?? []) { const e = eventoDaPendencia(p, podeMexer); if (e) lista.push(e); }
    if (verRevisoes) for (const r of revisoes.data ?? []) lista.push(eventoDaRevisao(r, podeMexer));
    return lista;
  }, [comPendencias, verPendencias, verRevisoes, pendencias.data, revisoes.data, podeMexer]);
  const semData = useMemo(() => (comPendencias && verPendencias ? (pendencias.data ?? []).filter(p => !p.due_at && !p.done_at) : []), [comPendencias, verPendencias, pendencias.data]);

  const invalidarPendencias = () => qc.invalidateQueries({ queryKey: ['pendencias'] });
  const invalidarRevisoes = () => qc.invalidateQueries({ queryKey: ['revisoes'] });

  // Mover uma pendência: a tela já mostra o horário novo; se o servidor recusar (ou o Google, num contato com Meet), volta e diz por quê.
  const moverPendencia = useMutation({
    mutationFn: (v: { id: string; para: string }) => atualizarPendencia(v.id, { para_quando: v.para }),
    onMutate: async v => {
      await qc.cancelQueries({ queryKey: ['pendencias', dono] });
      const antes = qc.getQueryData<Pendencia[]>(['pendencias', dono]);
      qc.setQueryData<Pendencia[]>(['pendencias', dono], l => l?.map(p => (p.id === v.id ? { ...p, due_at: v.para } : p)));
      return { antes };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(['pendencias', dono], ctx?.antes); setAviso({ tom: 'bad', texto: (e as Error).message }); },
    onSettled: invalidarPendencias,
  });
  const remarcar = useMutation({
    mutationFn: (v: { id: string; para: string }) => remarcarRevisao(v.id, v.para),
    onSuccess: r => {
      invalidarRevisoes();
      setAviso(r.no_mesmo_dia > 0
        ? { tom: 'amber', texto: `Revisão remarcada. Atenção: ${r.student_name.split(' ')[0]} agora tem ${r.no_mesmo_dia} outra${r.no_mesmo_dia > 1 ? 's revisões' : ' revisão'} nesse dia.` }
        : { tom: 'ok', texto: `Revisão de ${r.theme_name} remarcada para ${dataHora(r.scheduled_date)}. O aluno verá a nova data.` });
    },
    onError: e => setAviso({ tom: 'bad', texto: (e as Error).message }),
  });

  const aoMover = (e: Evento, novo: string) => {
    setAviso(null);
    if ('pendencia' in e.origem) moverPendencia.mutate({ id: e.origem.pendencia.id, para: novo });
    else setConfirmar({ revisao: e.origem.revisao, para: novo });
  };

  const vai = (n: number) => setAncora(a => somarDias(a, n * (modo === 'dia' ? 1 : 7)));
  const alunos = [...alunosConhecidos].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const carregando = (comPendencias && pendencias.isLoading) || (verRevisoes && revisoes.isLoading);
  const erro = pendencias.error ?? revisoes.error;

  return (
    <div className="stack">
      <div className="cal-barra">
        <Btn kind="s" sm onClick={() => setAncora(hoje)}>Hoje</Btn>
        <span className="hrow">
          <button type="button" className="ibtn plain" aria-label={modo === 'dia' ? 'Dia anterior' : 'Semana anterior'} onClick={() => vai(-1)}><ChevronLeft size={18} aria-hidden /></button>
          <button type="button" className="ibtn plain" aria-label={modo === 'dia' ? 'Próximo dia' : 'Próxima semana'} onClick={() => vai(1)}><ChevronRight size={18} aria-hidden /></button>
        </span>
        <h2 className="cal-titulo" aria-live="polite">{rotuloDoPeriodo(dias)}</h2>
        <span className="grow" />
        <div className="cal-seg" role="group" aria-label="Modo de exibição">
          <button type="button" className={modo === 'dia' ? 'on' : ''} aria-pressed={modo === 'dia'} onClick={() => setModo('dia')}>Dia</button>
          <button type="button" className={modo === 'semana' ? 'on' : ''} aria-pressed={modo === 'semana'} onClick={() => setModo('semana')}>Semana</button>
        </div>
      </div>

      <div className="cal-barra">
        {comPendencias && <label className="cal-camada"><input type="checkbox" checked={verPendencias} onChange={e => setVerPendencias(e.target.checked)} /><i className="cor-azul" style={{ background: 'var(--sw)' }} />Pendências e contatos</label>}
        <label className="cal-camada"><input type="checkbox" checked={verRevisoes} onChange={e => setVerRevisoes(e.target.checked)} /><i className="cor-amarelo" style={{ background: 'var(--sw)' }} />Revisões dos alunos</label>
        {verRevisoes && alunos.length > 0 && (
          <span className="input" style={{ maxWidth: 240 }}><select aria-label="Filtrar revisões por aluno" value={aluno} onChange={e => setAluno(e.target.value)}><option value="">Todos os alunos</option>{alunos.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></span>
        )}
      </div>

      {aviso && <Callout icon={Info} tone={aviso.tom}><p className="t-small" role="status">{aviso.texto}</p></Callout>}
      {carregando ? <Loading /> : erro ? <ErrorBox error={erro} onRetry={() => { pendencias.refetch(); revisoes.refetch(); }} /> : (
        <Calendario
          dias={dias} eventos={eventos} hoje={hoje} podeCriar={comPendencias && podeMexer}
          aoClicarVazio={iso => { setAviso(null); setNova(iso); }} aoClicarEvento={setAberto} aoMover={aoMover}
          aoClicarDia={modo === 'semana' ? d => { setAncora(d); setModo('dia'); } : undefined}
        />
      )}
      {!somenteLeitura && comPendencias && <p className="t-small muted">Clique num horário para criar, arraste para mudar o dia e a hora{verRevisoes ? ' (inclusive das revisões dos alunos)' : ''}, clique num item para pintar, concluir ou apagar. As revisões remarcadas por você avisam o aluno pela própria agenda dele.</p>}
      {somenteLeitura && <p className="t-small muted">Somente leitura: em “ver como” nada é alterado.</p>}

      {semData.length > 0 && (
        <div className="stack-s">
          <p className="t-small-strong">Sem data ({semData.length})</p>
          <div className="hrow wrap">{semData.map(p => <button key={p.id} type="button" className={`chip cor-${corDoTipo('pendencia', p.color)}`} style={{ borderLeft: '4px solid var(--ev-bd)' }} onClick={() => { const e = eventoDaPendencia({ ...p, due_at: new Date().toISOString() }, podeMexer); if (e) setAberto({ ...e, origem: { pendencia: p } }); }}>{p.title}</button>)}</div>
        </div>
      )}

      {nova && <NovaPendencia inicial={nova} google={google} fechar={() => setNova(null)} />}
      {aberto && 'pendencia' in aberto.origem && (
        <DetalheDaPendencia p={aberto.origem.pendencia} google={google} somenteLeitura={somenteLeitura} fechar={() => setAberto(null)} aoMudar={invalidarPendencias} />
      )}
      {aberto && 'revisao' in aberto.origem && (
        <DetalheDaRevisao r={aberto.origem.revisao} somenteLeitura={somenteLeitura} fechar={() => setAberto(null)} aoRemarcar={(id, para) => { setAberto(null); const r = revisoes.data?.find(x => x.id === id); if (r) setConfirmar({ revisao: r, para }); }} />
      )}
      {confirmar && (
        <ConfirmarRemarcacao
          revisao={confirmar.revisao} para={confirmar.para} outras={(revisoes.data ?? []).filter(x => x.student_id === confirmar.revisao.student_id && x.id !== confirmar.revisao.id && !x.completed && diaDe(x.scheduled_date) === diaDe(confirmar.para)).length}
          enviando={remarcar.isPending} erro={remarcar.error} fechar={() => { setConfirmar(null); remarcar.reset(); }}
          confirmar={() => remarcar.mutate({ id: confirmar.revisao.id, para: confirmar.para }, { onSuccess: () => setConfirmar(null) })}
        />
      )}
    </div>
  );
}

// -- detalhe de uma pendência ou contato ---------------------------------------------------

function DetalheDaPendencia({ p, google, somenteLeitura, fechar, aoMudar }: { p: Pendencia; google?: StatusDoGoogle; somenteLeitura: boolean; fechar: () => void; aoMudar: () => void }) {
  const [cor, setCor] = useState<string | null>(p.color);
  const [feita, setFeita] = useState(!!p.done_at);
  const [quando, setQuando] = useState(p.due_at ? paraCampoSP(p.due_at) : '');
  const [meet, setMeet] = useState<string | null>(p.meet_url);
  const original = p.due_at ? paraCampoSP(p.due_at) : '';
  const mudouData = quando !== original && !!doCampoSP(quando);
  const salvar = useMutation({ mutationFn: (campos: Parameters<typeof atualizarPendencia>[1]) => atualizarPendencia(p.id, campos), onSuccess: aoMudar });
  const apagar = useMutation({ mutationFn: () => excluirPendencia(p.id), onSuccess: () => { aoMudar(); fechar(); } });
  const convidar = useMutation({ mutationFn: () => enviarConviteMeet(p.id), onSuccess: r => { setMeet(r.meet_url); aoMudar(); } });
  const cancelar = useMutation({ mutationFn: () => cancelarConviteMeet(p.id), onSuccess: () => { setMeet(null); aoMudar(); } });
  const podeConvidar = p.kind === 'contato' && !!p.student_id && !!p.due_at && !feita && !meet && new Date(p.due_at).getTime() > Date.now() && google?.enabled === true && google.connected;
  const erro = salvar.error ?? apagar.error ?? convidar.error ?? cancelar.error;

  return (
    <Sheet
      titulo={p.title} fechar={fechar} enviar={mudouData ? 'Salvar data e hora' : 'Fechar'} erro={erro}
      aoEnviar={() => { if (mudouData) salvar.mutate({ para_quando: doCampoSP(quando) }, { onSuccess: fechar }); else fechar(); }} enviando={salvar.isPending}
    >
      <div className="hrow wrap">
        <Pill tone={p.kind === 'contato' ? 'blue' : 'ok'}>{p.kind === 'contato' ? 'Contato agendado' : 'Pendência'}</Pill>
        {p.channel && <Pill tone="neutral">{rotuloDoCanal(p.channel)}</Pill>}
        {feita && <Pill tone="muted">Concluída</Pill>}
      </div>
      {p.student_id && <p className="t-small">Aluno: <Link to={`/mentorandos/${p.student_id}/contatos`}>{p.student_name}</Link></p>}
      <label className="field"><span className="t-small-strong">Data e hora</span><span className="input"><input type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} disabled={somenteLeitura} /></span>{meet && <span className="t-small muted">Este contato tem convite do Meet: ao mudar a data, o Google avisa o aluno.</span>}</label>
      <div className="field"><span className="t-small-strong">Cor</span><Paleta valor={cor} desabilitado={somenteLeitura} aoEscolher={c => { setCor(c); salvar.mutate({ cor: c }); }} /></div>
      {meet && (
        <div className="hrow wrap t-small">
          <a className="hrow" href={meet} target="_blank" rel="noreferrer"><Video size={14} aria-hidden /> Entrar no Meet</a>
          {!somenteLeitura && !feita && <Btn kind="g" sm onClick={() => { if (window.confirm('Cancelar o convite? O aluno recebe o aviso de cancelamento do Google.')) cancelar.mutate(); }} disabled={cancelar.isPending}>Cancelar convite</Btn>}
        </div>
      )}
      {!somenteLeitura && (
        <div className="hrow wrap">
          <Btn kind="s" sm icon={CalendarCheck} onClick={() => { const v = !feita; setFeita(v); salvar.mutate({ feita: v }); }}>{feita ? 'Reabrir' : 'Concluir'}</Btn>
          {podeConvidar && <Btn kind="s" sm icon={CalendarPlus} onClick={() => { if (window.confirm(`Enviar um convite do Google Meet para ${p.student_name ?? 'o aluno'}? O Google manda o e-mail com o link.`)) convidar.mutate(); }} disabled={convidar.isPending}>Enviar convite do Meet</Btn>}
          <Btn kind="danger" sm onClick={() => { if (window.confirm(meet ? 'Apagar? O convite do Meet será cancelado e o aluno avisado.' : 'Apagar este item da agenda?')) apagar.mutate(); }} disabled={apagar.isPending}>Apagar</Btn>
        </div>
      )}
    </Sheet>
  );
}

// -- detalhe e remarcação de uma revisão ---------------------------------------------------

function DetalheDaRevisao({ r, somenteLeitura, fechar, aoRemarcar }: { r: RevisaoDoAluno; somenteLeitura: boolean; fechar: () => void; aoRemarcar: (id: string, para: string) => void }) {
  const [quando, setQuando] = useState(paraCampoSP(r.scheduled_date));
  const novo = doCampoSP(quando);
  const mudou = !!novo && quando !== paraCampoSP(r.scheduled_date);
  const trava = somenteLeitura || r.completed;
  return (
    <Sheet titulo={`Revisão: ${r.theme_name}`} fechar={fechar} enviar={mudou ? 'Remarcar' : 'Fechar'} aoEnviar={() => { if (mudou && novo) aoRemarcar(r.id, novo); else fechar(); }}>
      <div className="hrow wrap">
        <Pill tone="amber">{ROTULO_DA_ETAPA[r.stage] ?? r.stage}</Pill>
        <Pill tone={r.completed ? 'ok' : 'neutral'}>{r.completed ? 'Concluída' : 'Pendente'}</Pill>
        {r.category_name && <Pill tone="muted">{r.category_name}</Pill>}
      </div>
      <p className="t-small">Aluno: <Link to={`/mentorandos/${r.student_id}`}>{r.student_name}</Link></p>
      {r.moved_by_name && <p className="t-small muted">Última remarcação por {r.moved_by_name}{r.moved_at ? `, em ${dataHora(r.moved_at)}` : ''}.</p>}
      <label className="field">
        <span className="t-small-strong">Data e hora da revisão</span>
        <span className="input"><input type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} disabled={trava} /></span>
        <span className="t-small muted">{r.completed ? 'Revisão concluída: faz parte do histórico e não pode ser remarcada.' : somenteLeitura ? 'Somente leitura.' : 'O aluno vê a nova data na agenda dele. Você pode remarcar para qualquer dia futuro, mesmo além do limite que o aluno tem.'}</span>
      </label>
    </Sheet>
  );
}

function ConfirmarRemarcacao({ revisao, para, outras, enviando, erro, fechar, confirmar }: { revisao: RevisaoDoAluno; para: string; outras: number; enviando: boolean; erro: unknown; fechar: () => void; confirmar: () => void }) {
  const nome = revisao.student_name.split(' ')[0];
  return (
    <Sheet titulo="Remarcar revisão?" fechar={fechar} aoEnviar={confirmar} enviar="Remarcar" enviando={enviando} erro={erro}>
      <p className="t-body"><b>{revisao.theme_name}</b> ({ROTULO_DA_ETAPA[revisao.stage] ?? revisao.stage}) de {revisao.student_name}:</p>
      <p className="t-body">de <b>{dataHora(revisao.scheduled_date)}</b> para <b>{dataHora(para)}</b>.</p>
      {outras > 0 && <Callout icon={Info} tone="amber"><p className="t-small">{nome} já tem {outras} {outras > 1 ? 'outras revisões marcadas' : 'outra revisão marcada'} para esse dia. Dá para seguir, só confira se não vira peso demais.</p></Callout>}
      <p className="t-small muted">{nome} verá a nova data e hora na agenda de revisões dele, e o aviso de vencimento passa a valer para o novo horário.</p>
    </Sheet>
  );
}
