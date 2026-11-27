import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Info, Search } from 'lucide-react';
import { Callout, Card, ErrorBox, Loading, Stats } from '@/components/ui';
import { ColChart, Heat, LegendaDaConstancia } from '@/components/charts';
import { ConfirmarRemarcacao, DetalheDaRevisao } from '@/components/DetalheDaRevisao';
import { FonteDosNumeros, MetricasPendentes, Recomecos } from '@/pages/perfil/partes';
import EstudoDoAluno from '@/pages/perfil/EstudoDoAluno';
import { FEATURES } from '@/config';
import { useCarteira } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { useAtividade, useMetricasLiberadas } from '@/hooks/useMetricas';
import { remarcarRevisao, type RevisaoDoAluno } from '@/lib/api/acompanhamento';
import { getAgendamentos, type Agendamento } from '@/lib/api/revision';
import { diaDe, filtrarRevisoes, revisaoAtrasada, rotuloDaEtapa, somarDias } from '@/lib/calendario';
import { dataCurta, dataHora } from '@/lib/format';

export default function Estudo({ alunoId }: { alunoId: string }) {
  const liberado = useMetricasLiberadas();
  const at = useAtividade(alunoId);
  if (at.carregando) return <Card title="Constância"><Loading /></Card>;
  if (at.erro) return <ErrorBox error={at.erro} onRetry={at.refetch} />;
  if (!at.dados) return null;
  const { constancia: c, semanal: s } = at.dados;
  const pct = Math.round((c.diasAtivos / Math.max(1, c.diasNoPeriodo)) * 100);
  return (
    <>
      {FEATURES.acompanhamento && <EstudoDoAluno alunoId={alunoId} />}
      <Stats items={[
        { label: 'Dias com atividade', value: c.diasAtivos, tone: pct >= 50 ? 'ok' : pct >= 20 ? 'amber' : 'bad', extra: `de ${c.diasNoPeriodo} (${pct}%)` },
        { label: 'Sequência atual', value: `${c.sequenciaAtual} d`, tone: c.sequenciaAtual ? 'ok' : 'bad', extra: `melhor: ${c.melhorSequencia} d` },
        { label: 'Questões na revisão', value: s.questoes.reduce((a, b) => a + b, 0).toLocaleString('pt-BR'), extra: '12 semanas' },
      ]} />
      <div className="cols">
        <div className="stack">
          <Card title="Constância" sub="últimas 12 semanas" icon={CalendarCheck}>
            <Heat niveis={c.niveis} label={`${c.diasAtivos} dias com atividade nas últimas 12 semanas`} />
            <LegendaDaConstancia />
            <FonteDosNumeros>{`Cada coluna é uma semana (da mais antiga, à esquerda, até a atual); de cima para baixo, domingo a sábado. Conta um dia quando há revisão ou simulado registrado${liberado ? '' : ' (sem o contato das revisões agendadas, que depende do ajuste do servidor)'}.`}</FonteDosNumeros>
          </Card>
          <Card title="Questões por semana" sub="na revisão">
            <ColChart labels={s.rotulos} values={s.questoes} label="Questões por semana na revisão" />
            <FonteDosNumeros>Volume da revisão espaçada e dos simulados registrados. Não inclui o banco de questões.</FonteDosNumeros>
          </Card>
        </div>
        <div className="stack">
          {liberado ? <AgendaDeRevisoesDoAluno alunoId={alunoId} /> : <MetricasPendentes titulo="Agenda de revisões" />}
          <Recomecos alunoId={alunoId} />
        </div>
      </div>
    </>
  );
}

type FiltroAgenda = 'pendentes' | 'atrasadas' | 'concluidas';

function paraRevisao(a: Agendamento, alunoId: string, alunoNome: string): RevisaoDoAluno {
  return {
    id: a.id, student_id: alunoId, student_name: alunoNome, theme_id: a.theme_id ?? '',
    theme_name: a.theme_name, category_name: a.category_name ?? null, stage: a.stage,
    scheduled_date: a.scheduled_date, completed: a.completed, completed_at: a.completed_at ?? null,
    suggested_questions: a.suggested_questions ?? null, rescheduled_count: a.rescheduled_count ?? 0,
    moved_by_name: null, moved_at: null,
  };
}

/** Agenda limpa de revisões de UM aluno: resumo de 3 números, busca e ação sob demanda (remarcar / sugerir questões). */
function AgendaDeRevisoesDoAluno({ alunoId }: { alunoId: string }) {
  const qc = useQueryClient();
  const { somenteLeitura } = useEscopo();
  const { mentorandos } = useCarteira();
  const alunoNome = mentorandos.find(m => m.id === alunoId)?.nome ?? 'Aluno';
  const hoje = diaDe(new Date());
  const fim7 = somarDias(hoje, 7);

  const [filtro, setFiltro] = useState<FiltroAgenda>('pendentes');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(12);
  const [aberta, setAberta] = useState<RevisaoDoAluno | null>(null);
  const [confirmar, setConfirmar] = useState<{ revisao: RevisaoDoAluno; para: string } | null>(null);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'amber' | 'bad'; texto: string } | null>(null);

  const q = useQuery({ queryKey: ['agendamentos-todos', alunoId], queryFn: () => getAgendamentos(alunoId, false), staleTime: 60_000 });
  const remarcar = useMutation({
    mutationFn: (v: { id: string; para: string }) => remarcarRevisao(v.id, v.para),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['agendamentos-todos', alunoId] });
      qc.invalidateQueries({ queryKey: ['agendamentos', alunoId] });
      qc.invalidateQueries({ queryKey: ['revisoes'] });
      setAviso(r.no_mesmo_dia > 0
        ? { tom: 'amber', texto: `Remarcada para ${dataCurta(r.scheduled_date)}. O aluno agora tem ${r.no_mesmo_dia} outra${r.no_mesmo_dia > 1 ? 's revisões' : ' revisão'} nesse dia.` }
        : { tom: 'ok', texto: `Revisão de ${r.theme_name} remarcada para ${dataHora(r.scheduled_date)}.` });
    },
    onError: e => setAviso({ tom: 'bad', texto: (e as Error).message }),
  });

  const todas = useMemo(() => q.data ?? [], [q.data]);
  const pendentes = useMemo(() => todas.filter(a => !a.completed), [todas]);
  const atrasadas = useMemo(() => pendentes.filter(a => revisaoAtrasada(a, hoje)), [pendentes, hoje]);
  const hojeCount = useMemo(() => pendentes.filter(a => diaDe(a.scheduled_date) === hoje).length, [pendentes, hoje]);
  const prox7 = useMemo(() => pendentes.filter(a => { const d = diaDe(a.scheduled_date); return d >= hoje && d <= fim7; }).length, [pendentes, hoje, fim7]);
  const concluidas = useMemo(() => todas.filter(a => a.completed), [todas]);

  const visiveis = useMemo(() => {
    const base = filtro === 'atrasadas' ? atrasadas : filtro === 'concluidas' ? concluidas : pendentes;
    const filtradas = filtrarRevisoes(base, busca);
    return [...filtradas].sort((a, b) => (filtro === 'concluidas'
      ? (b.completed_at ?? b.scheduled_date).localeCompare(a.completed_at ?? a.scheduled_date)
      : a.scheduled_date.localeCompare(b.scheduled_date)));
  }, [filtro, atrasadas, concluidas, pendentes, busca]);

  if (q.isLoading) return <Card title="Agenda de revisões"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;

  return (
    <Card title="Agenda de revisões" sub="clique numa revisão para remarcar ou sugerir questões" icon={CalendarCheck}>
      <div className="grid2 keep">
        <div className="stat"><span className="t-label">Atrasadas</span><span className={`t-num${atrasadas.length ? ' c-bad' : ' c-ok'}`}>{atrasadas.length}</span></div>
        <div className="stat"><span className="t-label">Hoje · 7 dias</span><span className="t-num">{hojeCount} <span className="t-small muted">({prox7} em 7d)</span></span></div>
      </div>

      <div className="chips" role="group" aria-label="Filtrar revisões">
        {([
          ['pendentes', 'Pendentes', pendentes.length],
          ['atrasadas', 'Atrasadas', atrasadas.length],
          ['concluidas', 'Concluídas', concluidas.length],
        ] as [FiltroAgenda, string, number][]).map(([k, rot, n]) => (
          <button key={k} type="button" className={`chip${filtro === k ? ' on' : ''}`} aria-pressed={filtro === k} onClick={() => { setFiltro(k); setLimite(12); }}>
            {rot}<span className="n">{n}</span>
          </button>
        ))}
      </div>

      {todas.length > 5 && (
        <span className="input">
          <Search size={14} aria-hidden />
          <input type="search" placeholder="Buscar tema…" aria-label="Buscar tema na agenda" value={busca} onChange={e => setBusca(e.target.value)} />
        </span>
      )}

      {aviso && <Callout icon={Info} tone={aviso.tom}><p className="t-small" role="status">{aviso.texto}</p></Callout>}

      {!visiveis.length ? (
        <p className="t-small muted">Nenhuma revisão {filtro === 'atrasadas' ? 'atrasada' : filtro === 'concluidas' ? 'concluída' : 'pendente'}.</p>
      ) : (
        <div className="stack-xs">
          {visiveis.slice(0, limite).map(a => {
            const d = diaDe(a.scheduled_date);
            const atras = revisaoAtrasada(a, hoje);
            const quando = a.completed ? `Concluída ${dataCurta(a.completed_at ?? a.scheduled_date)}` : d === hoje ? 'Hoje' : atras ? `Atrasada · ${dataCurta(a.scheduled_date)}` : dataCurta(a.scheduled_date);
            return (
              <button
                key={a.id} type="button"
                className={`rev-card${atras ? ' atrasada' : ''}${a.completed ? ' feita' : ''}`}
                onClick={() => setAberta(paraRevisao(a, alunoId, alunoNome))}
              >
                <span className="rev-card-l1">
                  <span className="t-strong trunc">{a.theme_name}</span>
                  <span className="rev-tag">{rotuloDaEtapa(a.stage)}</span>
                </span>
                <span className="rev-card-l2">
                  <span className={atras ? 'c-bad' : d === hoje && !a.completed ? 'c-amber' : ''}>{quando}</span>
                  {a.category_name && <span>· {a.category_name}</span>}
                  {a.suggested_questions ? <span className="rev-q">· Meta: {a.suggested_questions} q.</span> : null}
                </span>
              </button>
            );
          })}
          {visiveis.length > limite && (
            <button type="button" className="link-btn t-small" onClick={() => setLimite(l => l + 20)}>
              Mostrar mais ({visiveis.length - limite} restantes)
            </button>
          )}
        </div>
      )}

      {aberta && (
        <DetalheDaRevisao
          r={aberta} somenteLeitura={somenteLeitura} mostrarAluno={false} fechar={() => setAberta(null)}
          aoRemarcar={(_id, para) => { setAberta(null); setConfirmar({ revisao: aberta, para }); }}
        />
      )}
      {confirmar && (
        <ConfirmarRemarcacao
          revisao={confirmar.revisao} para={confirmar.para}
          outras={pendentes.filter(x => x.id !== confirmar.revisao.id && diaDe(x.scheduled_date) === diaDe(confirmar.para)).length}
          enviando={remarcar.isPending} erro={remarcar.error} fechar={() => { setConfirmar(null); remarcar.reset(); }}
          confirmar={() => remarcar.mutate({ id: confirmar.revisao.id, para: confirmar.para }, { onSuccess: () => setConfirmar(null) })}
        />
      )}
    </Card>
  );
}
