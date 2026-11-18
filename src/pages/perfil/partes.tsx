import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Info, Lock, Target } from 'lucide-react';
import { Btn, Callout, Card, ErrorBox, Kv, Loading } from '@/components/ui';
import { getMeta, limparMeta, salvarMeta } from '@/lib/api/mentoring';
import { getRecomecos } from '@/lib/api/revision';
import { dataCurta } from '@/lib/format';

/** Aviso das métricas que dependem do ajuste de acesso do back-end (mentor). */
export function MetricasPendentes({ titulo = 'Desempenho, temas prioritários e revisões' }: { titulo?: string }) {
  return (
    <Card title={titulo} icon={Lock} iconTone="muted">
      <Callout icon={Info} tone="amber">
        <p className="t-small">Estas métricas aparecem aqui quando a versão do servidor que libera a leitura da revisão do aluno para quem o atende estiver publicada e a chave de função ligada. Até lá, o servidor só as entrega a administradores.</p>
      </Callout>
    </Card>
  );
}

/** Rodapé de gráficos: de onde vêm os números e o que eles não incluem. */
export const FonteDosNumeros = ({ children }: { children: string }) => <p className="t-small muted">{children}</p>;

export function MetaSemanal({ alunoId, somenteLeitura }: { alunoId: string; somenteLeitura: boolean }) {
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

export function Recomecos({ alunoId }: { alunoId: string }) {
  const q = useQuery({ queryKey: ['recomecos', alunoId], queryFn: () => getRecomecos(alunoId) });
  const ultimo = q.data?.results?.[0];
  if (!ultimo) return null;
  return (
    <Card title="Recomeçou a revisão" icon={History} iconTone="amber">
      <p className="t-small">Em {dataCurta(ultimo.reset_at)}, {ultimo.themes_restarted} temas voltaram à 1ª revisão e {ultimo.schedules_pending_removed} revisões pendentes saíram do calendário. O histórico de questões continua.</p>
    </Card>
  );
}
