/**
 * Detalhe e confirmação de remarcação de uma revisão de aluno.
 * Usado na Agenda (/agenda), em Revisões (/admin/revisoes) e no Perfil do mentorando (aba Estudo).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info, Target } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Btn, Callout, Pill } from '@/components/ui';
import type { RevisaoDoAluno } from '@/lib/api/acompanhamento';
import { definirSugestaoDeQuestoes } from '@/lib/api/revision';
import { diaDe, doCampoSP, paraCampoSP, revisaoAtrasada, rotuloDaEtapa } from '@/lib/calendario';
import { dataHora } from '@/lib/format';

export function DetalheDaRevisao({
  r, somenteLeitura, fechar, aoRemarcar, mostrarAluno = true,
}: {
  r: RevisaoDoAluno;
  somenteLeitura: boolean;
  fechar: () => void;
  aoRemarcar: (id: string, para: string) => void;
  mostrarAluno?: boolean;
}) {
  const qc = useQueryClient();
  const hoje = diaDe(new Date());
  const atrasada = revisaoAtrasada(r, hoje);
  const [quando, setQuando] = useState(paraCampoSP(r.scheduled_date));
  const [sugestao, setSugestao] = useState(r.suggested_questions != null ? String(r.suggested_questions) : '');
  const [salvoSugestao, setSalvoSugestao] = useState<string | null>(null);

  useEffect(() => {
    setQuando(paraCampoSP(r.scheduled_date));
    setSugestao(r.suggested_questions != null ? String(r.suggested_questions) : '');
    setSalvoSugestao(null);
  }, [r.id, r.scheduled_date, r.suggested_questions]);

  const novo = doCampoSP(quando);
  const mudou = !!novo && quando !== paraCampoSP(r.scheduled_date);
  const trava = somenteLeitura || r.completed;

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['revisoes'] });
    qc.invalidateQueries({ queryKey: ['agendamentos'] });
    qc.invalidateQueries({ queryKey: ['agendamentos-todos'] });
  };

  const salvarSugestao = useMutation({
    mutationFn: (valor: number | null) => definirSugestaoDeQuestoes(r.id, valor),
    onSuccess: (_resp, valor) => {
      invalidar();
      setSalvoSugestao(valor === null ? 'Sugestão removida.' : `Sugestão de ${valor} questões salva.`);
    },
  });

  const numeroValido = sugestao.trim() === '' || (Number.isInteger(Number(sugestao)) && Number(sugestao) >= 0);
  const mudouSugestao = (sugestao.trim() === '' ? null : Number(sugestao)) !== (r.suggested_questions ?? null);

  return (
    <Sheet
      titulo={`Revisão: ${r.theme_name}`}
      fechar={fechar}
      enviar={mudou ? 'Remarcar data' : 'Fechar'}
      aoEnviar={() => { if (mudou && novo) aoRemarcar(r.id, novo); else fechar(); }}
      erro={salvarSugestao.error}
    >
      <div className="hrow wrap">
        <Pill tone="amber">{rotuloDaEtapa(r.stage)}</Pill>
        {r.completed ? <Pill tone="ok">Concluída</Pill> : atrasada ? <Pill tone="bad">Atrasada</Pill> : <Pill tone="neutral">Pendente</Pill>}
        {r.category_name && <Pill tone="muted">{r.category_name}</Pill>}
        {(r.rescheduled_count ?? 0) > 0 && <Pill tone="muted">Adiada {r.rescheduled_count}x pelo aluno</Pill>}
      </div>

      {mostrarAluno && (
        <p className="t-small">Aluno: <Link to={`/mentorandos/${r.student_id}/estudo`}>{r.student_name}</Link></p>
      )}
      {r.moved_by_name && (
        <p className="t-small muted">Última remarcação por {r.moved_by_name}{r.moved_at ? `, em ${dataHora(r.moved_at)}` : ''}.</p>
      )}

      <div className="field">
        <span className="t-small-strong hrow"><Target size={14} aria-hidden /> Sugestão de questões do mentor</span>
        <div className="hrow wrap">
          <span className="input" style={{ maxWidth: 140 }}>
            <input
              type="number" inputMode="numeric" min={0} max={500} placeholder="Ex.: 30"
              aria-label="Sugestão de questões" value={sugestao}
              onChange={e => { setSugestao(e.target.value); setSalvoSugestao(null); }}
              disabled={trava || salvarSugestao.isPending}
            />
          </span>
          {!trava && (
            <>
              <Btn
                kind="s" sm
                disabled={!numeroValido || !mudouSugestao || salvarSugestao.isPending}
                onClick={() => salvarSugestao.mutate(sugestao.trim() === '' ? null : Number(sugestao))}
              >
                {salvarSugestao.isPending ? 'Salvando…' : 'Salvar sugestão'}
              </Btn>
              {(r.suggested_questions != null || sugestao !== '') && (
                <Btn
                  kind="g" sm
                  disabled={salvarSugestao.isPending}
                  onClick={() => { setSugestao(''); salvarSugestao.mutate(null); }}
                >
                  Limpar
                </Btn>
              )}
            </>
          )}
        </div>
        <span className="t-small muted">
          {salvoSugestao ?? 'Aparece na revisão do aluno como orientação de volume de questões.'}
        </span>
      </div>

      <label className="field">
        <span className="t-small-strong">Data da revisão</span>
        <span className="input"><input type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} disabled={trava} /></span>
        <span className="t-small muted">
          {r.completed
            ? 'Revisão concluída: faz parte do histórico e não pode ser remarcada.'
            : somenteLeitura
              ? 'Somente leitura.'
              : 'O aluno vê a nova data na agenda dele. Remarcar aqui não conta como adiamento do aluno.'}
        </span>
      </label>
    </Sheet>
  );
}

export function ConfirmarRemarcacao({
  revisao, para, outras, enviando, erro, fechar, confirmar,
}: {
  revisao: RevisaoDoAluno;
  para: string;
  outras: number;
  enviando: boolean;
  erro: unknown;
  fechar: () => void;
  confirmar: () => void;
}) {
  const nome = revisao.student_name.split(' ')[0];
  return (
    <Sheet titulo="Remarcar revisão?" fechar={fechar} aoEnviar={confirmar} enviar="Remarcar" enviando={enviando} erro={erro}>
      <p className="t-body"><b>{revisao.theme_name}</b> ({rotuloDaEtapa(revisao.stage)}) de {revisao.student_name}:</p>
      <p className="t-body">de <b>{dataHora(revisao.scheduled_date)}</b> para <b>{dataHora(para)}</b>.</p>
      {outras > 0 && (
        <Callout icon={Info} tone="amber">
          <p className="t-small">{nome} já tem {outras} {outras > 1 ? 'outras revisões marcadas' : 'outra revisão marcada'} para esse dia. Dá para seguir, só confira se não vira peso demais.</p>
        </Callout>
      )}
      <p className="t-small muted">{nome} verá a nova data na agenda de revisões dele, e o aviso de vencimento passa a valer para a nova data.</p>
    </Sheet>
  );
}
