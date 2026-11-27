import { CalendarCheck, GraduationCap, NotebookPen, Siren } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, Callout, Card, ErrorBox, Loading, MotivoPill, Pill, Stats } from '@/components/ui';
import { FonteDosNumeros, MetaSemanal, Recomecos } from '@/pages/perfil/partes';
import { useAtividade, useCalendario } from '@/hooks/useMetricas';
import { useEscopo } from '@/contexts/EscopoContext';
import { FEATURES } from '@/config';
import { getQuestionario } from '@/lib/api/revision';
import { tendencia } from '@/lib/metricas';
import { dataCurta, dataHora } from '@/lib/format';
import type { Mentorando } from '@/lib/carteira';

const ROTULO_ANO: Record<string, string> = {
  first_year: '1º ano', second_year: '2º ano', third_year: '3º ano',
  fourth_year: '4º ano', fifth_year: '5º ano', sixth_year: '6º ano', degree: 'Formado',
};

export default function Geral({ m }: { m: Mentorando }) {
  const { somenteLeitura } = useEscopo();
  const tom = m.situacao === 'alerta' ? 'bad' : 'amber';
  return (
    <>
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
          <Resumo alunoId={m.id} />
          <Ultimas alunoId={m.id} />
        </div>
        <div className="stack">
          <MetaSemanal alunoId={m.id} somenteLeitura={somenteLeitura} />
          <PerfilDeProva alunoId={m.id} />
          <Recomecos alunoId={m.id} />
          {!FEATURES.acompanhamento && (
            <Card title="Contatos e anotações" icon={NotebookPen} iconTone="muted">
              <p className="t-small muted">Registro de ligações e reuniões, anotações privadas e pendências dependem de um modelo novo no servidor. Por enquanto, o histórico da mentoria é a conversa.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Questionário de onboarding do aluno (momento, bancas/instituições-alvo e especialidades). */
function PerfilDeProva({ alunoId }: { alunoId: string }) {
  const q = useQuery({ queryKey: ['questionario', alunoId], queryFn: () => getQuestionario(alunoId), retry: false, staleTime: 5 * 60_000 });
  if (q.isLoading || q.error) return null;
  const maisRecente = q.data?.[0];
  return (
    <Card title="Perfil de prova" sub="questionário do aluno" icon={GraduationCap}>
      {!maisRecente ? (
        <p className="t-small muted">O aluno ainda não preencheu o questionário de perfil.</p>
      ) : (
        <div className="stack-s">
          <div className="hrow wrap between">
            <span className="t-small muted">Momento</span>
            <Pill tone="teal">{ROTULO_ANO[maisRecente.current_year] ?? maisRecente.current_year}</Pill>
          </div>
          {maisRecente.institutes.length > 0 && (
            <div className="stack-xs">
              <span className="t-small muted">Instituições de interesse</span>
              <div className="hrow wrap">{maisRecente.institutes.map(i => <Pill key={i} tone="neutral">{i}</Pill>)}</div>
            </div>
          )}
          {maisRecente.especialties.length > 0 && (
            <div className="stack-xs">
              <span className="t-small muted">Especialidades</span>
              <div className="hrow wrap">{maisRecente.especialties.map(e => <Pill key={e} tone="blue">{e}</Pill>)}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Os números que mais pesam, das últimas 12 semanas. */
function Resumo({ alunoId }: { alunoId: string }) {
  const { dados, carregando, erro, liberado, refetch } = useAtividade(alunoId);
  if (carregando) return <Card title="Últimas 12 semanas"><Loading /></Card>;
  if (erro) return <ErrorBox error={erro} onRetry={refetch} />;
  if (!dados) return null;
  const { constancia: c, semanal } = dados;
  const t = tendencia(semanal);
  const q14 = semanal.questoes.slice(-2).reduce((a, b) => a + b, 0);
  return (
    <Card title="Últimas 12 semanas" sub={liberado ? 'revisões e simulados registrados' : 'revisões isoladas e simulados registrados'} icon={CalendarCheck}>
      <Stats items={[
        { label: 'Dias com atividade', value: `${c.diasAtivos}/${c.diasNoPeriodo}`, tone: c.diasAtivos / Math.max(1, c.diasNoPeriodo) >= 0.5 ? 'ok' : c.diasAtivos / Math.max(1, c.diasNoPeriodo) >= 0.2 ? 'amber' : 'bad', to: `/mentorandos/${alunoId}/estudo` },
        { label: 'Sequência atual', value: `${c.sequenciaAtual} d`, tone: c.sequenciaAtual ? 'ok' : 'bad', extra: `melhor: ${c.melhorSequencia} d` },
        { label: 'Questões, 2 últimas semanas', value: q14, extra: 'na revisão' },
        { label: 'Acerto na revisão', value: t.recente != null ? `${t.recente}%` : '—', tone: t.recente == null ? 'muted' : t.recente >= 65 ? 'ok' : 'amber', extra: t.delta != null ? `${t.delta > 0 ? '+' : '−'}${Math.abs(t.delta)} pp contra as 2 anteriores` : undefined, to: `/mentorandos/${alunoId}/desempenho` },
      ]} />
      <FonteDosNumeros>Só o que passa pela revisão espaçada, pelas revisões isoladas e pelos simulados registrados. Questões respondidas direto no banco não entram aqui, então este número não é o “feito na semana” do painel do aluno.</FonteDosNumeros>
    </Card>
  );
}

function Ultimas({ alunoId }: { alunoId: string }) {
  const q = useCalendario(alunoId);
  if (q.isLoading) return null;
  const itens = [...(q.data?.items ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 8);
  return (
    <Card title="Atividade recente" sub="revisões isoladas e simulados registrados" right={<Link className="link" to={`/mentorandos/${alunoId}/estudo`}>Ver constância</Link>}>
      {itens.length ? <div className="list tight">{itens.map(i => (
        <div key={i.id} className="row">
          <span className="row-t"><span className="t-strong">{i.title}</span><span className="t-small muted">{i.kind === 'registered_simulado' ? 'Simulado registrado' : 'Revisão isolada'}{i.category_name ? ` · ${i.category_name}` : ''} · {dataHora(i.occurred_at)}</span></span>
          <span className="stack-xs" style={{ minWidth: 90, textAlign: 'right' }}><span className="t-small-strong">{i.questions_correct}/{i.questions_total}</span><Bar p={i.accuracy_percentage} tone={i.accuracy_percentage >= 65 ? 'ok' : 'amber'} h={5} /></span>
        </div>))}</div>
        : <p className="t-small muted">Nada registrado nas últimas 12 semanas.</p>}
    </Card>
  );
}
