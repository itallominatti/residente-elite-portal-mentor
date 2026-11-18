import { ClipboardList, Lightbulb, TrendingUp } from 'lucide-react';
import { Bar, Card, ErrorBox, Kv, Loading } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { FonteDosNumeros, MetricasPendentes } from '@/pages/perfil/partes';
import { useAtividade, useEvolucao, useMetricasLiberadas, useTemasPrioritarios, useCalendario } from '@/hooks/useMetricas';
import { porArea, tendencia } from '@/lib/metricas';
import { dataCurta } from '@/lib/format';

export default function Desempenho({ alunoId }: { alunoId: string }) {
  const liberado = useMetricasLiberadas();
  return (
    <div className="cols">
      <div className="stack">
        {liberado ? <Evolucao alunoId={alunoId} /> : <MetricasPendentes titulo="Acerto por semana e por área" />}
        <SimuladosRegistrados alunoId={alunoId} />
      </div>
      <div className="stack">
        {liberado ? <Temas alunoId={alunoId} /> : <MetricasPendentes titulo="Temas prioritários" />}
        {liberado && <Leitura alunoId={alunoId} />}
      </div>
    </div>
  );
}

function Evolucao({ alunoId }: { alunoId: string }) {
  const at = useAtividade(alunoId);
  const ev = useEvolucao(alunoId);
  if (at.carregando || ev.isLoading) return <Card title="Acerto por semana"><Loading /></Card>;
  const erro = at.erro ?? ev.error;
  if (erro) return <ErrorBox error={erro} onRetry={at.refetch} />;
  if (!at.dados || !ev.data) return null;
  const s = at.dados.semanal;
  const areas = porArea(ev.data.temas);
  const temDado = s.acerto.some(a => a != null);
  return (
    <>
      <Card title="Acerto por semana" sub="últimas 12 semanas, na revisão" icon={TrendingUp}>
        {temDado ? <LineChart labels={s.rotulos} series={[{ name: 'Acerto', data: s.acerto, tone: 'teal' }]} min={0} max={100} unit="%" label="Acerto semanal na revisão espaçada" />
          : <p className="t-small muted">Nenhuma questão registrada na revisão nas últimas 12 semanas.</p>}
        <FonteDosNumeros>Semanas sem questões ficam em branco, não em zero. Acerto = acertos ÷ questões dos contatos de revisão da semana.</FonteDosNumeros>
      </Card>
      <Card title="Desempenho por grande área" sub="toda a revisão do aluno" flush>
        {areas.length ? (
          <div className="tbl-wrap"><table className="tbl" aria-label="Desempenho por grande área">
            <thead><tr><th>Grande área</th><th className="r">Acerto</th><th className="r">Questões</th><th className="r">Temas</th></tr></thead>
            <tbody>{areas.map(a => <tr key={a.area}><td className="t-strong">{a.area}</td><td className={`r num${a.acerto < 60 ? ' c-bad' : ''}`}><b>{a.acerto}%</b></td><td className="r num">{a.feitas.toLocaleString('pt-BR')}</td><td className="r num muted">{a.temas}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="t-small muted" style={{ padding: '4px 16px 16px' }}>Sem questões na revisão ainda.</p>}
      </Card>
    </>
  );
}

function Temas({ alunoId }: { alunoId: string }) {
  const q = useTemasPrioritarios(alunoId);
  if (q.isLoading) return <Card title="Temas prioritários"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const niveis = q.data?.levels ?? [];
  const tom = { critico: 'bad', prioritario: 'amber', suporte_secundario: 'ok' } as const;
  return (
    <Card title="Temas prioritários" sub={`${q.data?.summary.critico ?? 0} críticos · ${q.data?.summary.prioritario ?? 0} prioritários`} icon={ClipboardList} iconTone="bad">
      <p className="t-small muted">Matriz peso × acerto, a mesma que o aluno vê na revisão espaçada.</p>
      {niveis.filter(n => n.key !== 'suporte_secundario' && n.themes.length).map(n => (
        <div key={n.key} className="stack-s">
          <span className="t-label">{n.title} · {n.count}</span>
          {n.themes.slice(0, 6).map(t => <div key={t.theme_id} className="metric"><Kv k={`${t.theme_name} · ${t.category_name}`} v={`${Math.round(t.overall_accuracy)}% (${t.total_questions_done} q.)`} tone={tom[n.key]} /><Bar p={t.overall_accuracy} tone={tom[n.key]} h={5} /></div>)}
        </div>
      ))}
      {!niveis.some(n => n.key !== 'suporte_secundario' && n.themes.length) && <p className="t-small muted">Nenhum tema crítico ou prioritário com dados suficientes.</p>}
    </Card>
  );
}

/** Texto montado por regra (sem IA), só com o que a tela já mostra. */
function Leitura({ alunoId }: { alunoId: string }) {
  const at = useAtividade(alunoId);
  const ev = useEvolucao(alunoId);
  if (!at.dados || !ev.data) return null;
  const t = tendencia(at.dados.semanal);
  const areas = porArea(ev.data.temas).filter(a => a.feitas >= 20);
  const pior = [...areas].sort((a, b) => a.acerto - b.acerto)[0];
  const frases: string[] = [];
  if (t.delta != null) frases.push(`O acerto na revisão ${t.delta < 0 ? 'caiu' : t.delta > 0 ? 'subiu' : 'ficou igual'}${t.delta ? ` ${Math.abs(t.delta)} pontos` : ''}: ${t.anterior}% nas duas semanas anteriores contra ${t.recente}% nas duas últimas.`);
  if (pior) frases.push(`A área com menor acerto é ${pior.area}, com ${pior.acerto}% em ${pior.feitas} questões.`);
  if (!frases.length) return null;
  return (
    <Card title="Leitura rápida" icon={Lightbulb} iconTone="amber">
      {frases.map((f, i) => <p key={i} className="t-body">{f}</p>)}
      <p className="t-small muted">Calculada pelas regras da tela, sem IA.</p>
    </Card>
  );
}

/** Simulados registrados pelo aluno (a prova da plataforma não está nesta rota). Disponível ao mentor sem depender do ajuste. */
function SimuladosRegistrados({ alunoId }: { alunoId: string }) {
  const q = useCalendario(alunoId);
  if (q.isLoading) return null;
  const sims = (q.data?.items ?? []).filter(i => i.kind === 'registered_simulado').sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  return (
    <Card title="Simulados registrados" sub="últimas 12 semanas" flush>
      {sims.length ? (
        <div className="tbl-wrap"><table className="tbl" aria-label="Simulados registrados">
          <thead><tr><th>Simulado</th><th className="r">Questões</th><th className="r">Nota</th><th className="r">Data</th></tr></thead>
          <tbody>{sims.map(i => <tr key={i.id}><td className="t-strong">{i.title}</td><td className="r num">{i.questions_correct}/{i.questions_total}</td><td className={`r num${i.accuracy_percentage < 60 ? ' c-bad' : ''}`}><b>{Math.round(i.accuracy_percentage)}%</b></td><td className="r num muted">{dataCurta(i.occurred_at)}</td></tr>)}</tbody>
        </table></div>
      ) : <p className="t-small muted" style={{ padding: '4px 16px 16px' }}>Nenhum simulado registrado. Os simulados feitos dentro da plataforma ainda não têm leitura para o mentor.</p>}
    </Card>
  );
}
