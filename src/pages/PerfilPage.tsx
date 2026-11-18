import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ClipboardList, History, Info, Lock, MessageSquare, NotebookPen, Siren, Target } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Avatar, Bar, Btn, Callout, Card, ErrorBox, Kv, Loading, MotivoPill, SituacaoPill, Stats } from '@/components/ui';
import { UltimaConversa } from '@/components/Carteira';
import SemPermissao from '@/pages/SemPermissao';
import { useCarteira } from '@/hooks/useCarteira';
import { useAuth } from '@/contexts/AuthContext';
import { useEscopo } from '@/contexts/EscopoContext';
import { getMeta, limparMeta, salvarMeta } from '@/lib/api/mentoring';
import { getAgendamentosPendentes, getEvolucao, getItensDoCalendario, getRecomecos, getTemasPrioritarios } from '@/lib/api/revision';
import { abrirConversa } from '@/lib/api/chat';
import { dataCurta, dataHora, diaSP, haQuanto } from '@/lib/format';
import { FEATURES } from '@/config';
import type { Mentorando } from '@/lib/carteira';

export default function PerfilPage() {
  const { id = '' } = useParams();
  const { mentorandos, isLoading, error, refetch, pronto } = useCarteira();
  const m = mentorandos.find(x => x.id === id);

  if (isLoading) return <Shell title="Mentorando" back="/mentorandos"><Loading /></Shell>;
  if (error) return <Shell title="Mentorando" back="/mentorandos"><ErrorBox error={error} onRetry={refetch} /></Shell>;
  // Fora da carteira: nem o nome aparece. O servidor também recusa (403).
  if (pronto && !m) return <SemPermissao />;
  if (!m) return null;
  return <Perfil m={m} />;
}

function Perfil({ m }: { m: Mentorando }) {
  const { isAdmin } = useAuth();
  const { somenteLeitura } = useEscopo();
  const nav = useNavigate();
  const qc = useQueryClient();
  const abrir = useMutation({
    mutationFn: () => abrirConversa(m.id),
    onSuccess: c => { qc.invalidateQueries({ queryKey: ['conversas'] }); nav(`/conversas/${c.id}`); },
  });
  const conversar = () => (m.conversaId ? nav(`/conversas/${m.conversaId}`) : abrir.mutate());
  const tom = m.situacao === 'alerta' ? 'bad' : 'amber';
  const metricas = isAdmin || FEATURES.metricasDoMentor;

  return (
    <Shell title={m.nome} back="/mentorandos" sub={<SituacaoPill s={m.situacao} />}>
      <div className="card phead">
        <Avatar nome={m.nome} id={m.id} size={56} status={m.situacao} />
        <div className="phead-t">
          <div className="hrow wrap"><h1 className="t-h1">{m.nome}</h1><SituacaoPill s={m.situacao} /></div>
          <p className="t-small muted">{m.email} · mentoria: {m.mentores.join(', ') || '—'}</p>
          <p className="t-small"><UltimaConversa m={m} />{m.esperandoDesde && <b className="c-amber"> · esperando resposta {haQuanto(m.esperandoDesde)}</b>}</p>
        </div>
        <div className="phead-a">
          {(m.conversaId || (!somenteLeitura && m.podeEscrever)) && <Btn icon={MessageSquare} onClick={conversar} disabled={abrir.isPending}>{somenteLeitura ? 'Ler a conversa' : 'Conversar'}</Btn>}
        </div>
      </div>
      {abrir.error && <ErrorBox error={abrir.error} />}

      {m.motivos.length > 0 && (
        <Callout icon={Siren} tone={tom}>
          <p className="t-strong">Por que {m.nome.split(' ')[0]} está no radar</p>
          <div className="prio-why" style={{ margin: '6px 0' }}>{m.motivos.map(x => <MotivoPill key={x.codigo} m={x} tone={tom} />)}</div>
          {m.resumo.length > 0 && <><p className="t-small-strong" style={{ marginTop: 6 }}>Antes da conversa</p><ul className="resumo-lines">{m.resumo.map((l, i) => <li key={i}>{l}</li>)}</ul></>}
          <p className="t-small muted" style={{ marginTop: 6 }}>Regras do servidor, sem IA. {m.ultimaMensagemDoRamo ? `Última mensagem da mentoria: ${dataCurta(m.ultimaMensagemDoRamo)}.` : 'Nenhuma mensagem da mentoria ainda.'}</p>
        </Callout>
      )}

      <div className="cols">
        <div className="stack">
          <Atividade alunoId={m.id} />
          {metricas ? <MetricasCompletas alunoId={m.id} /> : <MetricasPendentes />}
        </div>
        <div className="stack">
          <MetaSemanal alunoId={m.id} somenteLeitura={somenteLeitura} />
          <Recomecos alunoId={m.id} />
          <Card title="Contatos e anotações" icon={NotebookPen} iconTone="muted">
            <p className="t-small muted">Registro de ligações e reuniões, anotações privadas e pendências dependem de um modelo novo no servidor. Por enquanto, o histórico da mentoria é a conversa.</p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

/** Revisões isoladas e simulados registrados nos últimos 30 dias (o endpoint já checa quem atende o aluno). */
function Atividade({ alunoId }: { alunoId: string }) {
  const start = diaSP(-29), end = diaSP(0);
  const q = useQuery({ queryKey: ['calendario', alunoId, start], queryFn: () => getItensDoCalendario(alunoId, start, end) });
  if (q.isLoading) return <Card title="Últimos 30 dias"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const itens = [...(q.data?.items ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const total = itens.reduce((s, i) => s + i.questions_total, 0), certas = itens.reduce((s, i) => s + i.questions_correct, 0);
  const dias = new Set(itens.map(i => i.date)).size;
  return (
    <Card title="Últimos 30 dias" sub="revisões isoladas e simulados registrados" icon={CalendarCheck}>
      <Stats items={[
        { label: 'Dias com atividade', value: `${dias}/30`, tone: dias >= 12 ? 'ok' : dias >= 5 ? 'amber' : 'bad' },
        { label: 'Questões', value: total },
        { label: 'Acerto', value: total ? `${Math.round(certas / total * 100)}%` : '—', tone: !total ? 'muted' : certas / total >= .65 ? 'ok' : 'amber' },
        { label: 'Simulados registrados', value: itens.filter(i => i.kind === 'registered_simulado').length },
      ]} />
      {itens.length ? (
        <div className="list tight">{itens.slice(0, 8).map(i => (
          <div key={i.id} className="row">
            <span className="row-t"><span className="t-strong">{i.title}</span><span className="t-small muted">{i.kind === 'registered_simulado' ? 'Simulado registrado' : 'Revisão isolada'}{i.category_name ? ` · ${i.category_name}` : ''} · {dataHora(i.occurred_at)}</span></span>
            <span className="stack-xs" style={{ minWidth: 90, textAlign: 'right' }}><span className="t-small-strong">{i.questions_correct}/{i.questions_total}</span><Bar p={i.accuracy_percentage} tone={i.accuracy_percentage >= 65 ? 'ok' : 'amber'} h={5} /></span>
          </div>))}</div>
      ) : <p className="t-small muted">Nada registrado nos últimos 30 dias. Isso não inclui questões respondidas no banco e nas revisões agendadas.</p>}
    </Card>
  );
}

function MetricasPendentes() {
  return (
    <Card title="Desempenho, temas prioritários e revisões" icon={Lock} iconTone="muted">
      <Callout icon={Info} tone="amber">
        <p className="t-small">Estas métricas existem, mas hoje o servidor só entrega as de outro aluno para administradores: para o mentor, ele devolve os dados do próprio mentor, sem erro. Elas aparecem aqui assim que o back-end passar a aceitar quem atende o aluno (ajuste descrito na documentação do portal).</p>
      </Callout>
    </Card>
  );
}

function MetricasCompletas({ alunoId }: { alunoId: string }) {
  const ev = useQuery({ queryKey: ['evolucao', alunoId], queryFn: () => getEvolucao(alunoId) });
  const tp = useQuery({ queryKey: ['prioritarios', alunoId], queryFn: () => getTemasPrioritarios(alunoId) });
  const ag = useQuery({ queryKey: ['agendamentos', alunoId], queryFn: () => getAgendamentosPendentes(alunoId) });
  const err = ev.error ?? tp.error ?? ag.error;
  if (ev.isLoading || tp.isLoading || ag.isLoading) return <Card title="Desempenho"><Loading /></Card>;
  if (err) return <ErrorBox error={err} />;
  const s = ev.data!.summary, hoje = diaSP(0);
  const atrasadas = (ag.data ?? []).filter(a => !a.completed && a.scheduled_date < hoje).length;
  const criticos = tp.data?.levels.find(l => l.key === 'critico')?.themes ?? [];
  return (
    <>
      <Card title="Desempenho na revisão" icon={Target}>
        <Stats items={[
          { label: 'Acerto geral', value: `${Math.round(s.overall_accuracy)}%`, tone: s.overall_accuracy >= 65 ? 'ok' : 'amber' },
          { label: 'Questões', value: s.total_questions_done.toLocaleString('pt-BR') },
          { label: 'Revisões pendentes', value: s.total_schedules_pending, extra: `${atrasadas} atrasadas`, tone: atrasadas >= 5 ? 'bad' : 'teal' },
          { label: 'Temas', value: s.total_themes },
        ]} />
      </Card>
      <Card title="Temas críticos" sub={`${tp.data?.summary.critico ?? 0} críticos · ${tp.data?.summary.prioritario ?? 0} prioritários`} icon={ClipboardList} iconTone="bad">
        {criticos.length ? <div className="list">{criticos.slice(0, 6).map(t => (
          <div key={t.theme_id} className="metric"><Kv k={`${t.theme_name} · ${t.category_name}`} v={`${Math.round(t.overall_accuracy)}% (${t.total_questions_done} q.)`} tone="bad" /><Bar p={t.overall_accuracy} tone="bad" h={5} /></div>))}</div>
          : <p className="t-small muted">Nenhum tema crítico com dados suficientes.</p>}
        <p className="t-small muted">Matriz peso × acerto, a mesma que o aluno vê na revisão espaçada.</p>
      </Card>
    </>
  );
}

function MetaSemanal({ alunoId, somenteLeitura }: { alunoId: string; somenteLeitura: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['meta', alunoId], queryFn: () => getMeta(alunoId) });
  const [editando, setEditando] = useState(false);
  const [questoes, setQuestoes] = useState('');
  const [horas, setHoras] = useState('');
  const meta = q.data?.goal ?? null;
  useEffect(() => { setQuestoes(meta ? String(meta.weekly_questions) : ''); setHoras(meta?.weekly_hours ? String(meta.weekly_hours) : ''); }, [meta]);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['meta', alunoId] });
  const salvar = useMutation({ mutationFn: () => salvarMeta(alunoId, Number(questoes), horas ? Number(horas) : null), onSuccess: () => { setEditando(false); atualizar(); } });
  const limpar = useMutation({ mutationFn: () => limparMeta(alunoId), onSuccess: () => { setEditando(false); atualizar(); } });

  if (q.isLoading) return <Card title="Meta semanal"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const { min = 1, max = 3000, min_hours = 1, max_hours = 80 } = q.data ?? {};
  const enviar = (e: FormEvent) => { e.preventDefault(); salvar.mutate(); };
  const n = Number(questoes), h = horas ? Number(horas) : null;
  const valido = Number.isInteger(n) && n >= min && n <= max && (h === null || (Number.isInteger(h) && h >= min_hours && h <= max_hours));

  return (
    <Card title="Meta semanal" sub="o aluno vê no painel dele" icon={Target}>
      {!editando ? (
        <>
          {meta ? <div className="kv-list"><Kv k="Questões por semana" v={meta.weekly_questions} /><Kv k="Horas de foco" v={meta.weekly_hours ?? 'só questões'} />{meta.set_by_name && <Kv k="Definida por" v={`${meta.set_by_name}${meta.updated_at ? `, em ${dataCurta(meta.updated_at)}` : ''}`} />}</div>
            : <p className="t-small muted">Nenhuma meta combinada. Sem meta, o aluno vê só o volume, sem “quanto do combinado”.</p>}
          <div className="hrow wrap"><Btn kind="s" sm onClick={() => setEditando(true)} locked={somenteLeitura}>{meta ? 'Alterar meta' : 'Definir meta'}</Btn>{meta && <Btn kind="g" sm onClick={() => limpar.mutate()} locked={somenteLeitura} disabled={limpar.isPending}>Limpar meta</Btn>}</div>
        </>
      ) : (
        <form className="goal-form" onSubmit={enviar}>
          <label className="field"><span className="t-small-strong">Questões</span><span className="input"><input type="number" inputMode="numeric" min={min} max={max} required value={questoes} onChange={e => setQuestoes(e.target.value)} /></span></label>
          <label className="field"><span className="t-small-strong">Horas (opcional)</span><span className="input"><input type="number" inputMode="numeric" min={min_hours} max={max_hours} value={horas} onChange={e => setHoras(e.target.value)} /></span></label>
          <span className="t-small muted" style={{ gridColumn: '1 / -1' }}>Entre {min} e {max} questões; horas entre {min_hours} e {max_hours}, ou em branco.</span>
          <div className="hrow"><Btn type="submit" sm disabled={!valido || salvar.isPending}>Salvar</Btn><Btn kind="g" sm onClick={() => setEditando(false)}>Cancelar</Btn></div>
        </form>
      )}
      {(salvar.error || limpar.error) && <p className="t-small c-bad" role="alert">{((salvar.error ?? limpar.error) as Error).message}</p>}
    </Card>
  );
}

function Recomecos({ alunoId }: { alunoId: string }) {
  const q = useQuery({ queryKey: ['recomecos', alunoId], queryFn: () => getRecomecos(alunoId) });
  const ultimo = q.data?.results?.[0];
  if (!ultimo) return null;
  return (
    <Card title="Recomeçou a revisão" icon={History} iconTone="amber">
      <p className="t-small">Em {dataCurta(ultimo.reset_at)}, {ultimo.themes_restarted} temas voltaram à 1ª revisão e {ultimo.schedules_pending_removed} revisões pendentes saíram do calendário. O histórico de questões continua.</p>
    </Card>
  );
}
