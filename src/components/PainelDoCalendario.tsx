/**
 * O calendário da agenda:
 * - Na agenda do mentor (`comPendencias=true`): a grade de horas exibe APENAS os compromissos e
 *   pendências do mentor (que têm hora marcada). As revisões dos alunos ficam numa faixa compacta
 *   no topo de cada dia — sem sobrepor nem poluir a grade horária — e abrem num painel por aluno
 *   quando o dia está cheio.
 * - Na página de revisões do admin (`comPendencias=false`): exibe uma grade limpa por dia (sem
 *   horas artificiais), com busca, filtro de aluno e concluídas ocultas por padrão.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, Info, Search, Video } from 'lucide-react';
import { Calendario } from '@/components/Calendario';
import { ConfirmarRemarcacao, DetalheDaRevisao } from '@/components/DetalheDaRevisao';
import { NovaPendencia } from '@/components/NovaPendencia';
import { Paleta } from '@/components/Paleta';
import { Sheet } from '@/components/Sheet';
import { Btn, Callout, ErrorBox, Loading, Pill } from '@/components/ui';
import { useCarteira } from '@/hooks/useCarteira';
import {
  atualizarPendencia, cancelarConviteMeet, enviarConviteMeet, excluirPendencia, listarPendencias, listarRevisoes, remarcarRevisao, rotuloDoCanal,
  type Pendencia, type RevisaoDoAluno, type StatusDoGoogle,
} from '@/lib/api/acompanhamento';
import {
  agruparRevisoesPorDia, corDoTipo, diaDe, diasDaSemana, doCampoSP, filtrarRevisoes, NOME_DO_DIA, numeroDoDia, paraCampoSP,
  periodoDosDias, revisaoAtrasada, rotuloDaEtapa, rotuloDoPeriodo, somarDias,
  type Dia, type EventoDoCalendario,
} from '@/lib/calendario';
import { dataHora } from '@/lib/format';

type Origem = { pendencia: Pendencia };
type Evento = EventoDoCalendario<Origem>;
type Modo = 'semana' | 'dia';

const guardado = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

const DURACAO_DA_PENDENCIA_MIN = 30;

export function eventoDaPendencia(p: Pendencia, podeMexer: boolean): Evento | null {
  if (!p.due_at) return null;
  const tipo = p.kind === 'contato' ? 'contato' : 'pendencia';
  return {
    id: `p-${p.id}`, tipo, titulo: p.title, subtitulo: p.student_name ?? undefined, inicio: p.due_at,
    duracaoMin: p.kind === 'contato' ? p.meet_duration_min || 45 : DURACAO_DA_PENDENCIA_MIN,
    cor: corDoTipo(tipo, p.color), concluido: !!p.done_at, arrastavel: podeMexer && !p.done_at, origem: { pendencia: p },
  };
}

interface Props {
  /** `false` na página de revisões do admin: só as revisões dos alunos, em grade diária limpa. */
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
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [aluno, setAluno] = useState('');
  const [busca, setBusca] = useState('');
  const [nova, setNova] = useState<string | null>(null);
  const [pendenciaAberta, setPendenciaAberta] = useState<Pendencia | null>(null);
  const [revisaoAberta, setRevisaoAberta] = useState<RevisaoDoAluno | null>(null);
  const [diaAberto, setDiaAberto] = useState<Dia | null>(null);
  const [confirmar, setConfirmar] = useState<{ revisao: RevisaoDoAluno; para: string } | null>(null);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'amber' | 'bad'; texto: string } | null>(null);
  useEffect(() => { guardar('agenda_modo', modo); }, [modo]);

  const dias = useMemo(() => (modo === 'dia' ? [ancora] : diasDaSemana(ancora)), [modo, ancora]);
  const { de, ate } = periodoDosDias(dias);
  const dono = mentorId ?? 'eu';
  const { mentorandos } = useCarteira();

  const pendencias = useQuery({ queryKey: ['pendencias', dono], queryFn: () => listarPendencias({ mentorId }), enabled: comPendencias, refetchInterval: 120_000 });
  const revisoes = useQuery({
    queryKey: ['revisoes', dono, de, ate, aluno || 'todos', verConcluidas ? 'com' : 'sem'],
    queryFn: () => listarRevisoes({ de, ate, mentorId, alunoId: aluno || undefined, concluidas: verConcluidas }),
    enabled: verRevisoes, placeholderData: keepPreviousData, refetchInterval: 120_000,
  });

  // Junta alunos da carteira com os que aparecerem nas revisões (para admin em /admin/revisoes).
  const alunos = useMemo(() => {
    const mapa = new Map<string, string>();
    if (comPendencias) for (const m of mentorandos) mapa.set(m.id, m.nome);
    for (const r of revisoes.data ?? []) mapa.set(r.student_id, r.student_name);
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [comPendencias, mentorandos, revisoes.data]);

  const podeMexer = !somenteLeitura;

  const eventosDoMentor = useMemo<Evento[]>(() => {
    if (!comPendencias || !verPendencias) return [];
    const termo = busca.trim().toLowerCase();
    const lista: Evento[] = [];
    for (const p of pendencias.data ?? []) {
      if (!verConcluidas && p.done_at) continue;
      if (aluno && p.student_id !== aluno) continue;
      if (termo && !p.title.toLowerCase().includes(termo) && !(p.student_name ?? '').toLowerCase().includes(termo)) continue;
      const e = eventoDaPendencia(p, podeMexer);
      if (e) lista.push(e);
    }
    return lista;
  }, [comPendencias, verPendencias, verConcluidas, aluno, busca, pendencias.data, podeMexer]);

  const revisoesVisiveis = useMemo(
    () => (verRevisoes ? filtrarRevisoes(revisoes.data ?? [], busca) : []),
    [verRevisoes, revisoes.data, busca],
  );
  const revisoesPorDia = useMemo(
    () => agruparRevisoesPorDia(revisoesVisiveis, dias, hoje),
    [revisoesVisiveis, dias, hoje],
  );

  // Resumo rápido do período visível (entender a tela em 2 segundos).
  const resumo = useMemo(() => {
    const diasSet = new Set(dias);
    const compromissos = eventosDoMentor.filter(e => diasSet.has(diaDe(e.inicio))).length;
    let pendentes = 0, atrasadas = 0;
    for (const g of revisoesPorDia.values()) { pendentes += g.pendentes; atrasadas += g.atrasadas; }
    return { compromissos, pendentes, atrasadas };
  }, [dias, eventosDoMentor, revisoesPorDia]);

  const semData = useMemo(
    () => (comPendencias && verPendencias ? (pendencias.data ?? []).filter(p => !p.due_at && !p.done_at && (!aluno || p.student_id === aluno)) : []),
    [comPendencias, verPendencias, pendencias.data, aluno],
  );

  const invalidarPendencias = () => qc.invalidateQueries({ queryKey: ['pendencias'] });
  const invalidarRevisoes = () => {
    qc.invalidateQueries({ queryKey: ['revisoes'] });
    qc.invalidateQueries({ queryKey: ['agendamentos'] });
    qc.invalidateQueries({ queryKey: ['agendamentos-todos'] });
  };

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

  const vai = (n: number) => setAncora(a => somarDias(a, n * (modo === 'dia' ? 1 : 7)));
  const carregando = (comPendencias && pendencias.isLoading) || (verRevisoes && revisoes.isLoading);
  const erro = pendencias.error ?? revisoes.error;

  const faixaDasRevisoes = (dia: Dia) => {
    const g = revisoesPorDia.get(dia);
    if (!g || g.itens.length === 0) return <span className="rev-vazio">—</span>;
    const limiteInline = aluno ? 3 : 2;
    if (g.itens.length <= limiteInline) {
      return (
        <div className="rev-stack">
          {g.itens.map(r => {
            const atrasada = revisaoAtrasada(r, hoje);
            return (
              <button
                key={r.id} type="button"
                className={`rev-chip${atrasada ? ' atrasada' : ''}${r.completed ? ' feita' : ''}`}
                onClick={() => setRevisaoAberta(r)}
                title={`${r.theme_name} · ${r.student_name} (${rotuloDaEtapa(r.stage)})`}
              >
                <span className="rev-chip-t">{r.theme_name}</span>
                <span className="rev-chip-s">{aluno ? rotuloDaEtapa(r.stage) : r.student_name.split(' ')[0]}{r.suggested_questions ? ` · ${r.suggested_questions}q` : ''}</span>
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <button type="button" className={`rev-sum${g.atrasadas > 0 ? ' atrasada' : ''}`} onClick={() => setDiaAberto(dia)}>
        <b>{g.itens.length} revisões</b>
        <span>{aluno ? (g.atrasadas > 0 ? `${g.atrasadas} atras.` : `${g.pendentes} pend.`) : `${g.alunos} aluno${g.alunos > 1 ? 's' : ''}${g.atrasadas > 0 ? ` · ${g.atrasadas} atras.` : ''}`}</span>
      </button>
    );
  };

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

      {/* Resumo imediato do período */}
      <div className="hrow wrap">
        {comPendencias && verPendencias && <Pill tone="blue">{resumo.compromissos} compromisso{resumo.compromissos === 1 ? '' : 's'} no período</Pill>}
        {verRevisoes && <Pill tone="amber">{resumo.pendentes} revis{resumo.pendentes === 1 ? 'ão pendente' : 'ões pendentes'}</Pill>}
        {verRevisoes && resumo.atrasadas > 0 && <Pill tone="bad">{resumo.atrasadas} atrasada{resumo.atrasadas === 1 ? '' : 's'}</Pill>}
      </div>

      {/* Filtros unificados */}
      <div className="cal-barra">
        {comPendencias && (
          <label className="cal-camada">
            <input type="checkbox" checked={verPendencias} onChange={e => setVerPendencias(e.target.checked)} />
            <i className="cor-azul" style={{ background: 'var(--sw)' }} />Compromissos
          </label>
        )}
        <label className="cal-camada">
          <input type="checkbox" checked={verRevisoes} onChange={e => setVerRevisoes(e.target.checked)} />
          <i className="cor-amarelo" style={{ background: 'var(--sw)' }} />Revisões dos alunos
        </label>
        <label className="cal-camada">
          <input type="checkbox" checked={verConcluidas} onChange={e => setVerConcluidas(e.target.checked)} />
          Mostrar concluídas
        </label>
        <span className="grow" />
        <span className="input" style={{ maxWidth: 210 }}>
          <Search size={14} aria-hidden />
          <input type="search" placeholder="Buscar tema ou aluno…" aria-label="Buscar tema ou aluno" value={busca} onChange={e => setBusca(e.target.value)} />
        </span>
        {alunos.length > 0 && (
          <span className="input" style={{ maxWidth: 220 }}>
            <select aria-label="Filtrar por aluno" value={aluno} onChange={e => setAluno(e.target.value)}>
              <option value="">Todos os alunos</option>
              {alunos.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </span>
        )}
      </div>

      {aviso && <Callout icon={Info} tone={aviso.tom}><p className="t-small" role="status">{aviso.texto}</p></Callout>}

      {carregando ? <Loading /> : erro ? <ErrorBox error={erro} onRetry={() => { pendencias.refetch(); revisoes.refetch(); }} /> : comPendencias ? (
        <Calendario
          dias={dias} eventos={eventosDoMentor} hoje={hoje} podeCriar={podeMexer}
          aoClicarVazio={iso => { setAviso(null); setNova(iso); }}
          aoClicarEvento={e => setPendenciaAberta(e.origem.pendencia)}
          aoMover={(e, novo) => { setAviso(null); moverPendencia.mutate({ id: e.origem.pendencia.id, para: novo }); }}
          aoClicarDia={modo === 'semana' ? d => { setAncora(d); setModo('dia'); } : undefined}
          faixaDoDia={verRevisoes ? faixaDasRevisoes : undefined}
          rotuloDaFaixa="Rev."
        />
      ) : (
        <GradeDeRevisoesPorDia dias={dias} hoje={hoje} grupos={revisoesPorDia} alunoFiltrado={!!aluno} aoClicar={setRevisaoAberta} />
      )}

      {!somenteLeitura && comPendencias && (
        <p className="t-small muted">
          Horários: seus contatos e pendências (clique num horário para criar ou arraste para mover).
          {verRevisoes && ' Faixa “Rev.” no topo: revisões dos alunos — clique no resumo do dia ou na revisão para remarcar ou sugerir questões.'}
        </p>
      )}
      {somenteLeitura && <p className="t-small muted">Somente leitura: em “ver como” nada é alterado.</p>}

      {semData.length > 0 && (
        <div className="stack-s">
          <p className="t-small-strong">Sem data ({semData.length})</p>
          <div className="hrow wrap">
            {semData.map(p => (
              <button key={p.id} type="button" className={`chip cor-${corDoTipo('pendencia', p.color)}`} style={{ borderLeft: '4px solid var(--ev-bd)' }} onClick={() => setPendenciaAberta(p)}>
                {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {nova && <NovaPendencia inicial={nova} google={google} fechar={() => setNova(null)} />}
      {pendenciaAberta && (
        <DetalheDaPendencia p={pendenciaAberta} google={google} somenteLeitura={somenteLeitura} fechar={() => setPendenciaAberta(null)} aoMudar={invalidarPendencias} />
      )}
      {diaAberto && (
        <GavetaDoDia
          dia={diaAberto} hoje={hoje} itens={revisoesPorDia.get(diaAberto)?.itens ?? []}
          fechar={() => setDiaAberto(null)}
          aoEscolher={r => { setDiaAberto(null); setRevisaoAberta(r); }}
        />
      )}
      {revisaoAberta && (
        <DetalheDaRevisao
          r={revisaoAberta} somenteLeitura={somenteLeitura} fechar={() => setRevisaoAberta(null)}
          aoRemarcar={(id, para) => { setRevisaoAberta(null); const r = revisoes.data?.find(x => x.id === id) ?? revisaoAberta; setConfirmar({ revisao: r, para }); }}
        />
      )}
      {confirmar && (
        <ConfirmarRemarcacao
          revisao={confirmar.revisao} para={confirmar.para}
          outras={(revisoes.data ?? []).filter(x => x.student_id === confirmar.revisao.student_id && x.id !== confirmar.revisao.id && !x.completed && diaDe(x.scheduled_date) === diaDe(confirmar.para)).length}
          enviando={remarcar.isPending} erro={remarcar.error} fechar={() => { setConfirmar(null); remarcar.reset(); }}
          confirmar={() => remarcar.mutate({ id: confirmar.revisao.id, para: confirmar.para }, { onSuccess: () => setConfirmar(null) })}
        />
      )}
    </div>
  );
}

// -- grade de revisões por dia (para /admin/revisoes, sem horas artificiais) ----------------

function GradeDeRevisoesPorDia({
  dias, hoje, grupos, alunoFiltrado, aoClicar,
}: {
  dias: Dia[];
  hoje: Dia;
  grupos: ReturnType<typeof agruparRevisoesPorDia<RevisaoDoAluno>>;
  alunoFiltrado: boolean;
  aoClicar: (r: RevisaoDoAluno) => void;
}) {
  return (
    <div className={`rev-board${dias.length === 1 ? ' um-dia' : ''}`}>
      {dias.map(d => {
        const g = grupos.get(d)!;
        const nomeDia = NOME_DO_DIA[new Date(`${d}T12:00:00-03:00`).getUTCDay()];
        return (
          <section key={d} className={`rev-col${d === hoje ? ' hoje' : ''}`}>
            <header className="rev-col-h">
              <span className="hrow">
                <span className="cal-dia-n">{nomeDia}</span>
                <b className="rev-col-d">{numeroDoDia(d)}</b>
              </span>
              {g.itens.length > 0 && (
                <Pill tone={g.atrasadas > 0 ? 'bad' : 'neutral'}>{g.itens.length}</Pill>
              )}
            </header>
            <div className="rev-col-b">
              {g.itens.length === 0 ? (
                <p className="t-small muted" style={{ padding: '6px 2px' }}>Sem revisões</p>
              ) : (
                g.itens.map(r => {
                  const atrasada = revisaoAtrasada(r, hoje);
                  return (
                    <button
                      key={r.id} type="button"
                      className={`rev-card${atrasada ? ' atrasada' : ''}${r.completed ? ' feita' : ''}`}
                      onClick={() => aoClicar(r)}
                    >
                      <span className="rev-card-l1">
                        <span className="t-strong trunc">{r.theme_name}</span>
                        <span className="rev-tag">{rotuloDaEtapa(r.stage)}</span>
                      </span>
                      <span className="rev-card-l2">
                        {!alunoFiltrado && <span>{r.student_name.split(' ').slice(0, 2).join(' ')}</span>}
                        {r.category_name && <span>{r.category_name}</span>}
                        {r.suggested_questions ? <span className="rev-q">{r.suggested_questions} q.</span> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// -- gaveta limpa de um dia cheio (agrupada por aluno) -------------------------------------

function GavetaDoDia({ dia, hoje, itens, fechar, aoEscolher }: { dia: Dia; hoje: Dia; itens: RevisaoDoAluno[]; fechar: () => void; aoEscolher: (r: RevisaoDoAluno) => void }) {
  const porAluno = useMemo(() => {
    const mapa = new Map<string, { nome: string; lista: RevisaoDoAluno[] }>();
    for (const r of itens) {
      const e = mapa.get(r.student_id) ?? { nome: r.student_name, lista: [] };
      e.lista.push(r);
      mapa.set(r.student_id, e);
    }
    return [...mapa.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
  }, [itens]);

  return (
    <Sheet titulo={`Revisões · ${rotuloDoPeriodo([dia])}`} fechar={fechar} enviar="Fechar" aoEnviar={fechar}>
      <p className="t-small muted">{itens.length} revisões de {porAluno.length} aluno{porAluno.length > 1 ? 's' : ''}. Clique em qualquer revisão para remarcar ou definir sugestão de questões.</p>
      <div className="stack">
        {porAluno.map(([id, g]) => (
          <div key={id} className="stack-xs">
            <div className="hrow between">
              <Link className="t-small-strong" to={`/mentorandos/${id}/estudo`}>{g.nome}</Link>
              <span className="t-small muted">{g.lista.length}</span>
            </div>
            <div className="stack-xs">
              {g.lista.map(r => {
                const atrasada = revisaoAtrasada(r, hoje);
                return (
                  <button key={r.id} type="button" className={`rev-card${atrasada ? ' atrasada' : ''}${r.completed ? ' feita' : ''}`} onClick={() => aoEscolher(r)}>
                    <span className="rev-card-l1">
                      <span className="t-strong trunc">{r.theme_name}</span>
                      <span className="rev-tag">{rotuloDaEtapa(r.stage)}</span>
                    </span>
                    <span className="rev-card-l2">
                      {atrasada && <span className="c-bad">Atrasada</span>}
                      {r.completed && <span className="c-ok">Concluída</span>}
                      {r.category_name && <span>{r.category_name}</span>}
                      {r.suggested_questions ? <span className="rev-q">Meta: {r.suggested_questions} q.</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
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
