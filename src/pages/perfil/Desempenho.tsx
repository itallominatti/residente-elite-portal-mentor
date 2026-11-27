import { useMemo, useState } from 'react';
import { BookOpen, ClipboardList, Lightbulb, Search, TrendingUp } from 'lucide-react';
import { Bar, Btn, Card, Chev, ErrorBox, Kv, Loading, Pill, Stats } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { Sheet } from '@/components/Sheet';
import { FonteDosNumeros, MetricasPendentes } from '@/pages/perfil/partes';
import { useAtividade, useEvolucao, useMetricasLiberadas, useTemasPrioritarios, useCalendario } from '@/hooks/useMetricas';
import type { TemaDaEvolucao } from '@/lib/api/revision';
import { rotuloDaEtapa } from '@/lib/calendario';
import { porArea, tendencia } from '@/lib/metricas';
import { dataCurta } from '@/lib/format';

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export default function Desempenho({ alunoId }: { alunoId: string }) {
  const liberado = useMetricasLiberadas();
  return (
    <div className="cols">
      <div className="stack">
        {liberado ? <Evolucao alunoId={alunoId} /> : <MetricasPendentes titulo="Acerto por semana e por área" />}
        {liberado && <TemasNaRevisao alunoId={alunoId} />}
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

/** Lista pesquisável dos temas do aluno, com clique para abrir histórico de contatos (equivalente enxuto da aba Evolução do hub). */
function TemasNaRevisao({ alunoId }: { alunoId: string }) {
  const ev = useEvolucao(alunoId);
  const [busca, setBusca] = useState('');
  const [area, setArea] = useState('');
  const [limite, setLimite] = useState(10);
  const [selecionado, setSelecionado] = useState<TemaDaEvolucao | null>(null);

  const temas = useMemo(() => ev.data?.temas ?? [], [ev.data?.temas]);
  const areas = useMemo(() => [...new Set(temas.map(t => t.category_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [temas]);
  const filtrados = useMemo(() => {
    const q = norm(busca.trim());
    return temas
      .filter(t => (!area || t.category_name === area) && (!q || norm(t.theme_name).includes(q) || norm(t.category_name).includes(q)))
      .sort((a, b) => a.overall_accuracy - b.overall_accuracy);
  }, [temas, area, busca]);

  if (ev.isLoading || ev.error || !temas.length) return null;

  return (
    <Card title="Evolução por tema" sub={`${temas.length} temas · clique para ver o histórico`} icon={BookOpen} flush>
      <div className="hrow wrap" style={{ padding: '4px 16px 12px' }}>
        <span className="input grow" style={{ minWidth: 180 }}>
          <Search size={14} aria-hidden />
          <input type="search" placeholder="Buscar tema…" aria-label="Buscar tema na evolução" value={busca} onChange={e => { setBusca(e.target.value); setLimite(10); }} />
        </span>
        {areas.length > 1 && (
          <span className="input" style={{ maxWidth: 200 }}>
            <select aria-label="Filtrar temas por grande área" value={area} onChange={e => { setArea(e.target.value); setLimite(10); }}>
              <option value="">Todas as áreas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </span>
        )}
      </div>

      {!filtrados.length ? (
        <p className="t-small muted" style={{ padding: '4px 16px 16px' }}>Nenhum tema com esse filtro.</p>
      ) : (
        <div>
          {filtrados.slice(0, limite).map(t => (
            <button key={t.theme_id} type="button" className="tema-row" onClick={() => setSelecionado(t)}>
              <span className="row-t">
                <span className="t-strong trunc">{t.theme_name}</span>
                <span className="t-small muted">{t.category_name} · {rotuloDaEtapa(t.current_stage)}{t.theme_weight ? ` · Peso ${t.theme_weight}` : ''}</span>
              </span>
              <span className="hrow">
                <span className="stack-xs" style={{ textAlign: 'right' }}>
                  <span className={`t-small-strong${t.overall_accuracy < 60 ? ' c-bad' : t.overall_accuracy >= 70 ? ' c-ok' : ''}`}>{Math.round(t.overall_accuracy)}%</span>
                  <span className="t-tiny muted">{t.total_questions_correct}/{t.total_questions_done}</span>
                </span>
                <Chev />
              </span>
            </button>
          ))}
          {filtrados.length > limite && (
            <div style={{ padding: '10px 16px 14px' }}>
              <Btn kind="g" sm onClick={() => setLimite(l => l + 15)}>Mostrar mais ({filtrados.length - limite} restantes)</Btn>
            </div>
          )}
        </div>
      )}

      {selecionado && <DetalheDoTema tema={selecionado} fechar={() => setSelecionado(null)} />}
    </Card>
  );
}

function DetalheDoTema({ tema, fechar }: { tema: TemaDaEvolucao; fechar: () => void }) {
  const contatos = useMemo(() => [...tema.contacts].sort((a, b) => b.contact_date.localeCompare(a.contact_date)), [tema.contacts]);
  return (
    <Sheet titulo={tema.theme_name} fechar={fechar} enviar="Fechar" aoEnviar={fechar}>
      <div className="hrow wrap">
        <Pill tone="muted">{tema.category_name}</Pill>
        {tema.theme_weight && <Pill tone={tema.theme_weight === 'A' ? 'bad' : tema.theme_weight === 'B' ? 'amber' : 'neutral'}>Peso {tema.theme_weight}</Pill>}
        <Pill tone="teal">{rotuloDaEtapa(tema.current_stage)}</Pill>
      </div>
      <Stats items={[
        { label: 'Acerto geral', value: `${Math.round(tema.overall_accuracy)}%`, tone: tema.overall_accuracy >= 70 ? 'ok' : tema.overall_accuracy >= 50 ? 'amber' : 'bad' },
        { label: 'Questões', value: `${tema.total_questions_correct}/${tema.total_questions_done}` },
        { label: 'Contatos', value: contatos.length },
      ]} />
      {tema.next_scheduled_date && <p className="t-small muted">Próxima revisão agendada: <b>{dataCurta(tema.next_scheduled_date)}</b>.</p>}
      <div className="stack-s">
        <span className="t-label">Histórico de revisões ({contatos.length})</span>
        {!contatos.length ? <p className="t-small muted">Nenhum contato registrado neste tema ainda.</p> : (
          <div className="list tight">
            {contatos.map(c => (
              <div key={c.id} className="row">
                <span className="row-t">
                  <span className="t-small-strong">{c.contact_type.toUpperCase()} · {dataCurta(c.contact_date)}</span>
                  {c.notes && <span className="t-small muted" style={{ whiteSpace: 'pre-line' }}>{c.notes}</span>}
                </span>
                <span className="stack-xs" style={{ minWidth: 80, textAlign: 'right' }}>
                  <span className={`t-small-strong${c.accuracy_percentage < 60 ? ' c-bad' : c.accuracy_percentage >= 70 ? ' c-ok' : ''}`}>{Math.round(c.accuracy_percentage)}%</span>
                  <span className="t-tiny muted">{c.questions_correct}/{c.questions_done}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Temas({ alunoId }: { alunoId: string }) {
  const q = useTemasPrioritarios(alunoId);
  const [area, setArea] = useState('');
  const [verSuporte, setVerSuporte] = useState(false);

  const niveis = useMemo(() => q.data?.levels ?? [], [q.data?.levels]);
  const areas = useMemo(() => [...new Set(niveis.flatMap(n => n.themes.map(t => t.category_name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [niveis]);

  if (q.isLoading) return <Card title="Temas prioritários"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;

  const tom = { critico: 'bad', prioritario: 'amber', suporte_secundario: 'ok' } as const;
  const suporte = niveis.find(n => n.key === 'suporte_secundario');
  const niveisVisiveis = niveis.filter(n => n.key !== 'suporte_secundario' || verSuporte);

  return (
    <Card
      title="Temas prioritários"
      sub={`${q.data?.summary.critico ?? 0} críticos · ${q.data?.summary.prioritario ?? 0} prioritários`}
      icon={ClipboardList} iconTone="bad"
      right={suporte && suporte.count > 0 ? <Btn kind="g" sm onClick={() => setVerSuporte(v => !v)}>{verSuporte ? 'Ocultar suporte' : `+ Suporte (${suporte.count})`}</Btn> : undefined}
    >
      <p className="t-small muted">Matriz peso × acerto, a mesma que o aluno vê na revisão espaçada.</p>
      {areas.length > 1 && (
        <span className="input" style={{ maxWidth: 220 }}>
          <select aria-label="Filtrar prioritários por área" value={area} onChange={e => setArea(e.target.value)}>
            <option value="">Todas as áreas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </span>
      )}
      {niveisVisiveis.map(n => {
        const lista = area ? n.themes.filter(t => t.category_name === area) : n.themes;
        if (!lista.length) return null;
        return (
          <div key={n.key} className="stack-s">
            <span className="t-label">{n.title} · {area ? lista.length : n.count}</span>
            {lista.slice(0, 8).map(t => (
              <div key={t.theme_id} className="metric">
                <Kv k={`${t.theme_name} · ${t.category_name}`} v={`${Math.round(t.overall_accuracy)}% (${t.total_questions_done} q.)`} tone={tom[n.key]} />
                <Bar p={t.overall_accuracy} tone={tom[n.key]} h={5} />
              </div>
            ))}
          </div>
        );
      })}
      {!niveisVisiveis.some(n => (area ? n.themes.filter(t => t.category_name === area) : n.themes).length) && (
        <p className="t-small muted">Nenhum tema prioritário {area ? 'nesta área' : 'com dados suficientes'}.</p>
      )}
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
      ) : <p className="t-small muted" style={{ padding: '4px 16px 16px' }}>Nenhum simulado registrado fora da plataforma. Os simulados feitos dentro da plataforma aparecem na aba “Estudo”.</p>}
    </Card>
  );
}
