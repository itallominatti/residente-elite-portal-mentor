import { CalendarCheck } from 'lucide-react';
import { Card, ErrorBox, Kv, Loading, Stats } from '@/components/ui';
import { ColChart, Heat, LegendaDaConstancia } from '@/components/charts';
import { FonteDosNumeros, MetricasPendentes, Recomecos } from '@/pages/perfil/partes';
import { useAtividade, useMetricasLiberadas, useResumoDasRevisoes } from '@/hooks/useMetricas';

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
          {liberado ? <Revisoes alunoId={alunoId} /> : <MetricasPendentes titulo="Revisões atrasadas" />}
          <Recomecos alunoId={alunoId} />
        </div>
      </div>
    </>
  );
}

function Revisoes({ alunoId }: { alunoId: string }) {
  const { resumo, isLoading, error, refetch } = useResumoDasRevisoes(alunoId);
  if (isLoading) return <Card title="Revisões"><Loading /></Card>;
  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (!resumo) return null;
  return (
    <Card title="Revisões" icon={CalendarCheck}>
      <div className="grid2 keep">
        <div className="stat"><span className="t-label">Atrasadas</span><span className={`t-num${resumo.atrasadas ? ' c-bad' : ' c-ok'}`}>{resumo.atrasadas}</span></div>
        <div className="stat"><span className="t-label">Pendentes</span><span className="t-num">{resumo.pendentes}</span></div>
      </div>
      {resumo.porEtapa.map(e => <Kv key={e.etapa} k={e.etapa} v={`${e.atrasadas} atrasada${e.atrasadas > 1 ? 's' : ''}`} />)}
      <Kv k="Nos próximos 7 dias" v={resumo.proximos7} />
      <FonteDosNumeros>Atrasada é a revisão pendente com data anterior a hoje.</FonteDosNumeros>
    </Card>
  );
}
