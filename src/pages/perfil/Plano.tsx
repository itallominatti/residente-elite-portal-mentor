import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { Bar, Btn, Card, Empty, ErrorBox, Loading, Pill } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { MetaSemanal } from '@/pages/perfil/partes';
import { useAuth } from '@/contexts/AuthContext';
import { useEscopo } from '@/contexts/EscopoContext';
import { atualizarObjetivo, criarObjetivo, excluirObjetivo, listarObjetivos, type Objetivo } from '@/lib/api/acompanhamento';
import { FEATURES } from '@/config';
import { diaSP } from '@/lib/format';

export default function Plano({ alunoId }: { alunoId: string }) {
  const { somenteLeitura } = useEscopo();
  return (
    <div className="cols">
      <div className="stack">
        {FEATURES.acompanhamento
          ? <Objetivos alunoId={alunoId} />
          : <Card title="Plano combinado" icon={ClipboardList} iconTone="muted"><p className="t-small muted">Objetivos com prazo e a pauta dos contatos aparecem aqui quando a versão do servidor com contatos, anotações e plano estiver publicada e a chave de função ligada. A meta semanal ao lado já funciona: é o que o aluno vê no painel dele.</p></Card>}
      </div>
      <div className="stack">
        <MetaSemanal alunoId={alunoId} somenteLeitura={somenteLeitura} />
      </div>
    </div>
  );
}

const prazoLegivel = (iso: string) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };

function Objetivos({ alunoId }: { alunoId: string }) {
  const { user } = useAuth();
  const { somenteLeitura } = useEscopo();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const q = useQuery({ queryKey: ['plano', alunoId], queryFn: () => listarObjetivos(alunoId) });
  const atualizar = () => qc.invalidateQueries({ queryKey: ['plano', alunoId] });
  const mudar = useMutation({ mutationFn: (v: { id: string; campos: Parameters<typeof atualizarObjetivo>[1] }) => atualizarObjetivo(v.id, v.campos), onSuccess: atualizar });
  const apagar = useMutation({ mutationFn: (id: string) => excluirObjetivo(id), onSuccess: atualizar });

  if (q.isLoading) return <Card title="Plano combinado"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const todos = q.data ?? [];
  const abertos = todos.filter(o => !o.done_at), feitos = todos.filter(o => o.done_at);
  const linha = (o: Objetivo) => (
    <LinhaDoObjetivo key={o.id} o={o} meu={o.author_id === user?.id} somenteLeitura={somenteLeitura}
      mudar={campos => mudar.mutate({ id: o.id, campos })} apagar={() => { if (window.confirm('Apagar este objetivo?')) apagar.mutate(o.id); }} />
  );
  return (
    <Card title="Plano combinado" sub={todos.length ? `${abertos.length} em andamento` : undefined} icon={ClipboardList} right={<Btn kind="s" sm icon={Plus} onClick={() => setNovo(true)} locked={somenteLeitura}>Novo objetivo</Btn>}>
      {!todos.length ? <Empty icon={ClipboardList} title="Nenhum objetivo combinado">Registre o que você e o aluno combinaram, com prazo, para acompanhar o progresso.</Empty> : (
        <div>
          {abertos.map(linha)}
          {feitos.length > 0 && <p className="t-small-strong" style={{ marginTop: 12 }}>Concluídos</p>}
          {feitos.map(linha)}
        </div>
      )}
      {(mudar.error || apagar.error) && <p className="t-small c-bad" role="alert">{((mudar.error ?? apagar.error) as Error).message}</p>}
      {novo && <NovoObjetivo alunoId={alunoId} fechar={() => setNovo(false)} />}
    </Card>
  );
}

function LinhaDoObjetivo({ o, meu, somenteLeitura, mudar, apagar }: { o: Objetivo; meu: boolean; somenteLeitura: boolean; mudar: (c: { progresso?: number; concluido?: boolean }) => void; apagar: () => void }) {
  const atrasado = !o.done_at && !!o.due_date && o.due_date < diaSP();
  return (
    <div className="objetivo">
      <div className="hrow wrap between">
        <span className="t-strong">{o.title}</span>
        <span className="hrow">
          {o.done_at ? <Pill tone="ok" icon={CheckCircle2}>Concluído</Pill> : atrasado ? <Pill tone="bad">Prazo vencido</Pill> : null}
          {o.due_date && <span className="t-small muted">prazo {prazoLegivel(o.due_date)}</span>}
        </span>
      </div>
      {o.detail && <p className="t-small" style={{ whiteSpace: 'pre-wrap' }}>{o.detail}</p>}
      <Bar p={o.progress} tone={o.done_at ? 'ok' : atrasado ? 'bad' : 'teal'} />
      <div className="hrow wrap between">
        <span className="t-small muted">{o.progress}% · combinado por {meu ? 'você' : o.author_name}</span>
        {!somenteLeitura && (
          <span className="hrow wrap">
            {!o.done_at && <input type="range" min={0} max={100} step={5} defaultValue={o.progress} aria-label={`Progresso de ${o.title}`} onMouseUp={e => mudar({ progresso: Number(e.currentTarget.value) })} onTouchEnd={e => mudar({ progresso: Number(e.currentTarget.value) })} onKeyUp={e => mudar({ progresso: Number(e.currentTarget.value) })} style={{ width: 120 }} />}
            <Btn kind="g" sm onClick={() => mudar({ concluido: !o.done_at })}>{o.done_at ? 'Reabrir' : 'Concluir'}</Btn>
            {meu && <button type="button" className="ibtn plain" aria-label="Apagar objetivo" onClick={apagar}><Trash2 size={16} aria-hidden /></button>}
          </span>
        )}
      </div>
    </div>
  );
}

function NovoObjetivo({ alunoId, fechar }: { alunoId: string; fechar: () => void }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [prazo, setPrazo] = useState('');
  const salvar = useMutation({
    mutationFn: () => criarObjetivo(alunoId, { titulo: titulo.trim(), detalhe: detalhe.trim(), prazo: prazo || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plano', alunoId] }); fechar(); },
  });
  return (
    <Sheet titulo="Novo objetivo" fechar={fechar} aoEnviar={() => salvar.mutate()} enviar="Salvar objetivo" enviando={salvar.isPending} desabilitado={!titulo.trim()} erro={salvar.error}>
      <label className="field"><span className="t-small-strong">Objetivo</span><span className="input"><input required maxLength={160} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: fechar Pediatria até o simulado de dezembro" /></span></label>
      <label className="field"><span className="t-small-strong">Detalhe (opcional)</span><span className="input area"><textarea rows={3} maxLength={1000} value={detalhe} onChange={e => setDetalhe(e.target.value)} /></span></label>
      <label className="field"><span className="t-small-strong">Prazo (opcional)</span><span className="input"><input type="date" min={diaSP()} value={prazo} onChange={e => setPrazo(e.target.value)} /></span></label>
    </Sheet>
  );
}
