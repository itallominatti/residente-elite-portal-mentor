import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Sheet } from '@/components/Sheet';
import { Btn, Card, Empty, ErrorBox, Loading, PageHead, Pill } from '@/components/ui';
import { useCarteira } from '@/hooks/useCarteira';
import { useEscopo } from '@/contexts/EscopoContext';
import { CANAIS, criarPendencia, excluirPendencia, listarPendencias, marcarPendencia, rotuloDoCanal, type Canal, type Pendencia } from '@/lib/api/acompanhamento';
import { montarAgenda, ROTULO_DO_GRUPO } from '@/lib/agenda';
import { dataHora } from '@/lib/format';

export default function AgendaPage() {
  const { somenteLeitura } = useEscopo();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);
  const [mostrarFeitas, setMostrarFeitas] = useState(false);
  const q = useQuery({ queryKey: ['pendencias'], queryFn: () => listarPendencias(), refetchInterval: 120_000 });
  const atualizar = () => qc.invalidateQueries({ queryKey: ['pendencias'] });
  const marcar = useMutation({ mutationFn: (v: { id: string; feita: boolean }) => marcarPendencia(v.id, v.feita), onSuccess: atualizar });
  const apagar = useMutation({ mutationFn: (id: string) => excluirPendencia(id), onSuccess: atualizar });
  const agenda = useMemo(() => montarAgenda(q.data ?? []), [q.data]);

  const linha = (x: Pendencia) => (
    <div key={x.id} className={`pend${x.done_at ? ' feita' : ''}`}>
      <input type="checkbox" checked={!!x.done_at} disabled={somenteLeitura || marcar.isPending} onChange={e => marcar.mutate({ id: x.id, feita: e.target.checked })} aria-label={`${x.done_at ? 'Reabrir' : 'Concluir'}: ${x.title}`} />
      <span className="row-t grow">
        <span className="t-strong">{x.title}</span>
        <span className="t-small muted">
          {x.due_at ? dataHora(x.due_at) : 'sem data'}
          {x.student_id && <> · <Link to={`/mentorandos/${x.student_id}/contatos`}>{x.student_name}</Link></>}
          {x.kind === 'contato' && x.channel && <> · {rotuloDoCanal(x.channel)}</>}
        </span>
      </span>
      {x.kind === 'contato' && <Pill tone="blue" icon={MessageSquare}>Contato</Pill>}
      {!somenteLeitura && <button type="button" className="ibtn plain" aria-label={`Apagar: ${x.title}`} onClick={() => { if (window.confirm('Apagar este item da agenda?')) apagar.mutate(x.id); }}><Trash2 size={16} aria-hidden /></button>}
    </div>
  );

  return (
    <Shell title="Agenda" sub={q.data ? `${agenda.abertas} em aberto` : undefined}>
      <PageHead title="Agenda e pendências" sub="Os combinados dos seus contatos e o que você precisa fazer. Só você vê esta lista." right={<Btn icon={Plus} onClick={() => setNovo(true)} locked={somenteLeitura}>Nova pendência</Btn>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          {!agenda.grupos.length && <Card><Empty icon={CalendarClock} title="Nada na agenda">Os próximos passos e os contatos que você agendar ao registrar um contato aparecem aqui.</Empty></Card>}
          {agenda.grupos.map(g => (
            <Card key={g.grupo} title={ROTULO_DO_GRUPO[g.grupo]} sub={`${g.itens.length}`} icon={CalendarClock} iconTone={g.grupo === 'atrasadas' ? 'bad' : g.grupo === 'hoje' ? 'amber' : 'teal'}>
              <div className="agenda-grupo">{g.itens.map(linha)}</div>
            </Card>
          ))}
          {agenda.feitas.length > 0 && (
            <Card title="Concluídas" sub={`${agenda.feitas.length}`} right={<Btn kind="g" sm onClick={() => setMostrarFeitas(v => !v)}>{mostrarFeitas ? 'Ocultar' : 'Mostrar'}</Btn>}>
              {mostrarFeitas && <div className="agenda-grupo">{agenda.feitas.slice(0, 30).map(linha)}</div>}
            </Card>
          )}
          {(marcar.error || apagar.error) && <p className="t-small c-bad" role="alert">{((marcar.error ?? apagar.error) as Error).message}</p>}
        </>
      )}
      {novo && <NovaPendencia fechar={() => setNovo(false)} />}
    </Shell>
  );
}

const paraCampo = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function NovaPendencia({ fechar }: { fechar: () => void }) {
  const qc = useQueryClient();
  const { mentorandos } = useCarteira();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'tarefa' | 'contato'>('tarefa');
  const [aluno, setAluno] = useState('');
  const [quando, setQuando] = useState('');
  const [canal, setCanal] = useState<Canal>('video');
  const salvar = useMutation({
    mutationFn: () => criarPendencia({ titulo: titulo.trim(), tipo, aluno_id: aluno || null, para_quando: quando ? new Date(quando).toISOString() : null, canal: tipo === 'contato' ? canal : null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pendencias'] }); fechar(); },
  });
  const valido = !!titulo.trim() && (tipo === 'tarefa' || !!quando);
  const ordenados = useMemo(() => [...mentorandos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [mentorandos]);
  return (
    <Sheet titulo="Nova pendência" fechar={fechar} aoEnviar={() => salvar.mutate()} enviar="Salvar" enviando={salvar.isPending} desabilitado={!valido} erro={salvar.error}>
      <label className="field"><span className="t-small-strong">Tipo</span><span className="input"><select value={tipo} onChange={e => setTipo(e.target.value as 'tarefa' | 'contato')} aria-label="Tipo"><option value="tarefa">Pendência</option><option value="contato">Contato agendado</option></select></span></label>
      <label className="field"><span className="t-small-strong">O que fazer</span><span className="input"><input required maxLength={160} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tipo === 'contato' ? 'Ex.: conversa sobre o plano de dezembro' : 'Ex.: montar plano de revisão'} /></span></label>
      <label className="field"><span className="t-small-strong">Aluno (opcional)</span><span className="input"><select value={aluno} onChange={e => setAluno(e.target.value)} aria-label="Aluno"><option value="">Nenhum</option>{ordenados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></span></label>
      <label className="field"><span className="t-small-strong">{tipo === 'contato' ? 'Quando' : 'Para quando (opcional)'}</span><span className="input"><input type="datetime-local" required={tipo === 'contato'} min={paraCampo(new Date())} value={quando} onChange={e => setQuando(e.target.value)} /></span></label>
      {tipo === 'contato' && <label className="field"><span className="t-small-strong">Canal</span><span className="input"><select value={canal} onChange={e => setCanal(e.target.value as Canal)} aria-label="Canal">{CANAIS.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}</select></span></label>}
    </Sheet>
  );
}
