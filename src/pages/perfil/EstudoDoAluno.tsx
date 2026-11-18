/* O que o aluno estudou na plataforma (simulados, caderno de erros, flashcards e foco), lido do servidor. */
import { useQuery } from '@tanstack/react-query';
import { BookX, Layers, Timer, Trophy } from 'lucide-react';
import { Bar, Callout, Card, ErrorBox, Kv, Loading } from '@/components/ui';
import { FonteDosNumeros } from '@/pages/perfil/partes';
import { getEstudo } from '@/lib/api/acompanhamento';
import { dataCurta, haQuanto } from '@/lib/format';

export default function EstudoDoAluno({ alunoId }: { alunoId: string }) {
  const q = useQuery({ queryKey: ['estudo', alunoId], queryFn: () => getEstudo(alunoId), staleTime: 60_000 });
  if (q.isLoading) return <Card title="Estudo na plataforma"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data;
  if (!e) return null;
  const { simulados: s, caderno_de_erros: c, flashcards: f, foco } = e;
  const maxMotivo = Math.max(1, ...c.por_motivo.map(x => x.total));
  return (
    <>
      <div className="cols">
        <div className="stack">
          <Card title="Simulados na plataforma" sub={`${s.total_finalizados} finalizado${s.total_finalizados === 1 ? '' : 's'}`} icon={Trophy}>
            {s.finalizados.length ? (
              <div className="tbl-wrap"><table className="tbl" aria-label="Simulados finalizados">
                <thead><tr><th>Simulado</th><th className="r">Nota</th><th className="r">Acertos</th><th className="r">Quando</th></tr></thead>
                <tbody>{s.finalizados.map(x => <tr key={x.id}><td className="t-strong">{x.titulo}</td><td className="r num">{x.nota === null ? '—' : `${Math.round(x.nota)}%`}</td><td className="r num">{x.acertos} / {x.acertos + x.erros}</td><td className="r t-small muted">{dataCurta(x.finalizado_em)}</td></tr>)}</tbody>
              </table></div>
            ) : <p className="t-small muted">Nenhum simulado finalizado na plataforma.</p>}
            {s.parados.length > 0 && <Callout icon={Timer} tone="amber"><p className="t-small-strong">Simulado parado</p>{s.parados.map(p => <p key={p.id} className="t-small">{p.titulo}: começou {haQuanto(p.comecou_em)} e não terminou.</p>)}</Callout>}
            <FonteDosNumeros>Só simulados feitos na plataforma (modo prova). Simulados registrados à mão ficam em “Desempenho”.</FonteDosNumeros>
          </Card>
          <Card title="Caderno de erros" sub={`${c.total} no total · ${c.ultimos_30_dias} nos últimos 30 dias`} icon={BookX}>
            {c.total === 0 ? <p className="t-small muted">O aluno ainda não anotou erros.</p> : (
              <div className="stack-s">
                {c.por_motivo.map(x => <div key={x.motivo} className="stack-xs"><Kv k={x.rotulo} v={x.total} /><Bar p={(x.total / maxMotivo) * 100} tone="amber" h={5} /></div>)}
                {c.por_area.length > 0 && <><p className="t-small-strong" style={{ marginTop: 6 }}>Por área</p>{c.por_area.map(a => <Kv key={a.area ?? 'sem'} k={a.area ?? 'Sem área'} v={a.total} />)}</>}
              </div>
            )}
            <FonteDosNumeros>Só contagens. O texto das questões e as anotações do aluno não são exibidos ao mentor.</FonteDosNumeros>
          </Card>
        </div>
        <div className="stack">
          <Card title="Flashcards" icon={Layers}>
            <div className="grid2 keep">
              <div className="stat"><span className="t-label">Atrasados</span><span className={`t-num${f.atrasados ? ' c-bad' : ' c-ok'}`}>{f.atrasados}</span></div>
              <div className="stat"><span className="t-label">Para hoje</span><span className="t-num">{f.para_hoje}</span></div>
            </div>
            <Kv k="Cartões agendados" v={f.cartoes_agendados} />
            <Kv k="Sessões nos últimos 14 dias" v={f.sessoes_ultimos_14_dias} />
            <Kv k="Tempo de estudo na semana" v={`${f.minutos_na_semana} min`} />
            <Kv k="Última sessão" v={f.ultima_sessao_em ? haQuanto(f.ultima_sessao_em) : 'nunca'} />
            <Kv k="Avaliações em 30 dias" v={`${f.avaliacoes_ultimos_30_dias.facil} fáceis · ${f.avaliacoes_ultimos_30_dias.medio} médios · ${f.avaliacoes_ultimos_30_dias.dificil} difíceis`} />
          </Card>
          <Card title="Rotinas de foco" icon={Timer}>
            {foco.rotinas.length ? foco.rotinas.map(r => <Kv key={r.nome} k={r.nome} v={`${r.minutos_de_foco} min foco · ${r.minutos_de_pausa} pausa · ${r.rodadas} rodadas`} />) : <p className="t-small muted">O aluno não criou rotinas de foco.</p>}
            {!foco.registra_sessoes && <FonteDosNumeros>A plataforma guarda as rotinas, não as sessões de foco: horas de foco não aparecem aqui.</FonteDosNumeros>}
          </Card>
        </div>
      </div>
    </>
  );
}
