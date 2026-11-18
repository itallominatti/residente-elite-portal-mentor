/* Aba "Contatos e notas": histórico de contatos, pauta para o próximo e anotações privadas. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCopy, Lock, MessageSquare, NotebookPen, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Btn, Callout, Card, Empty, ErrorBox, Loading, Pill } from '@/components/ui';
import { RegistrarContato } from '@/components/RegistrarContato';
import { useAuth } from '@/contexts/AuthContext';
import { useEscopo } from '@/contexts/EscopoContext';
import {
  criarNota, editarNota, excluirContato, excluirNota, listarContatos, listarNotas, listarObjetivos, listarPendencias,
  rotuloDoCanal, rotuloDoHumor, type Contato, type Nota,
} from '@/lib/api/acompanhamento';
import { ApiError } from '@/lib/http';
import { dataHora, haQuanto } from '@/lib/format';
import { montarPauta } from '@/lib/pauta';
import type { Mentorando } from '@/lib/carteira';

export default function Contatos({ m }: { m: Mentorando }) {
  const { somenteLeitura } = useEscopo();
  const [registrando, setRegistrando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  return (
    <>
      <div className="hrow wrap">
        <Btn icon={Plus} onClick={() => setRegistrando(true)} locked={somenteLeitura}>Registrar contato</Btn>
        <Btn kind="s" icon={Sparkles} onClick={() => setPreparando(p => !p)}>{preparando ? 'Fechar a pauta' : 'Preparar contato'}</Btn>
      </div>
      {preparando && <Pauta m={m} />}
      <div className="cols">
        <div className="stack"><Historico alunoId={m.id} /></div>
        <div className="stack"><Notas alunoId={m.id} nome={m.nome} /></div>
      </div>
      {registrando && <RegistrarContato alunoId={m.id} alunoNome={m.nome} fechar={() => setRegistrando(false)} />}
    </>
  );
}

function Historico({ alunoId }: { alunoId: string }) {
  const { user } = useAuth();
  const { somenteLeitura } = useEscopo();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['contatos', alunoId], queryFn: () => listarContatos(alunoId) });
  const apagar = useMutation({ mutationFn: (id: string) => excluirContato(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['contatos', alunoId] }) });

  if (q.isLoading) return <Card title="Contatos"><Loading /></Card>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const contatos = q.data ?? [];
  return (
    <Card title="Contatos" sub={contatos.length ? `${contatos.length} registrado${contatos.length > 1 ? 's' : ''}` : undefined} icon={MessageSquare}>
      {!contatos.length ? <Empty icon={MessageSquare} title="Nenhum contato registrado">Registre o primeiro contato para o histórico e a pauta do próximo ficarem completos.</Empty> : (
        <ol className="timeline">
          {contatos.map(c => <ItemDoContato key={c.id} c={c} meu={c.author_id === user?.id} podeApagar={c.author_id === user?.id && !somenteLeitura} apagar={() => { if (window.confirm('Apagar este contato? As pendências criadas por ele continuam na agenda.')) apagar.mutate(c.id); }} />)}
        </ol>
      )}
      {apagar.error && <p className="t-small c-bad" role="alert">{(apagar.error as Error).message}</p>}
    </Card>
  );
}

function ItemDoContato({ c, meu, podeApagar, apagar }: { c: Contato; meu: boolean; podeApagar: boolean; apagar: () => void }) {
  return (
    <li className="tl-item">
      <div className="hrow wrap between">
        <span className="t-small-strong">{rotuloDoCanal(c.channel)}{c.duration_min ? ` · ${c.duration_min} min` : ''}</span>
        <span className="t-small muted" title={dataHora(c.occurred_at)}>{haQuanto(c.occurred_at)} · {meu ? 'você' : c.author_name}</span>
      </div>
      <p className="t-body" style={{ whiteSpace: 'pre-wrap' }}>{c.summary}</p>
      <div className="hrow wrap between">
        {c.mood ? <Pill tone={c.mood === 'desanimado' ? 'amber' : c.mood === 'motivado' ? 'ok' : 'neutral'}>Saiu {rotuloDoHumor(c.mood).toLowerCase()}</Pill> : <span />}
        {podeApagar && <button type="button" className="ibtn plain" aria-label="Apagar contato" onClick={apagar}><Trash2 size={16} aria-hidden /></button>}
      </div>
    </li>
  );
}

function Pauta({ m }: { m: Mentorando }) {
  const alunoId = m.id;
  const contatos = useQuery({ queryKey: ['contatos', alunoId], queryFn: () => listarContatos(alunoId) });
  const pendencias = useQuery({ queryKey: ['pendencias', 'aluno', alunoId], queryFn: () => listarPendencias({ feitas: false, alunoId }) });
  const objetivos = useQuery({ queryKey: ['plano', alunoId], queryFn: () => listarObjetivos(alunoId) });
  const [copiado, setCopiado] = useState(false);
  if (contatos.isLoading || pendencias.isLoading || objetivos.isLoading) return <Card title="Pauta"><Loading /></Card>;
  const erro = contatos.error ?? pendencias.error ?? objetivos.error;
  if (erro) return <ErrorBox error={erro} />;
  const secoes = montarPauta(m, contatos.data ?? [], pendencias.data ?? [], objetivos.data ?? []);
  const texto = [`Pauta para ${m.nome}`, ...secoes.flatMap(s => ['', s.titulo, ...s.itens.map(i => `- ${i}`)])].join('\n');
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sem permissão da área de transferência */ } };
  return (
    <Card title={`Pauta para falar com ${m.nome.split(' ')[0]}`} sub="montada com os dados do portal, sem IA" icon={Sparkles} right={<Btn kind="s" sm icon={ClipboardCopy} onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</Btn>}>
      <div className="stack">
        {secoes.map(s => (
          <div key={s.titulo} className="stack-s">
            <p className="t-small-strong">{s.titulo}</p>
            <ul className="resumo-lines">{s.itens.map((i, k) => <li key={k}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Notas({ alunoId, nome }: { alunoId: string; nome: string }) {
  const qc = useQueryClient();
  const { somenteLeitura } = useEscopo();
  const q = useQuery({ queryKey: ['notas', alunoId], queryFn: () => listarNotas(alunoId), retry: false });
  const [texto, setTexto] = useState('');
  const [sensivel, setSensivel] = useState(false);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const atualizar = () => qc.invalidateQueries({ queryKey: ['notas', alunoId] });
  const criar = useMutation({ mutationFn: () => criarNota(alunoId, texto.trim(), sensivel), onSuccess: () => { setTexto(''); setSensivel(false); atualizar(); } });
  const salvar = useMutation({ mutationFn: () => editarNota(editando!.id, editando!.texto.trim()), onSuccess: () => { setEditando(null); atualizar(); } });
  const apagar = useMutation({ mutationFn: (id: string) => excluirNota(id), onSuccess: atualizar });

  if (q.isLoading) return <Card title="Anotações privadas"><Loading /></Card>;
  // O servidor nega ao administrador (com ou sem "ver como"): a tela explica em vez de mostrar erro.
  if (q.error instanceof ApiError && q.error.status === 403) {
    return (
      <Card title="Anotações privadas" icon={Lock} iconTone="muted">
        <Callout icon={Lock} tone="violet"><p className="t-small">{q.error.message} Elas pertencem a quem as escreveu: nem o administrador as abre por aqui.</p></Callout>
      </Card>
    );
  }
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const notas: Nota[] = q.data ?? [];
  return (
    <Card title="Anotações privadas" sub="só você vê" icon={NotebookPen}>
      <p className="t-small muted">Suas anotações sobre {nome.split(' ')[0]}. Nem outros mentores nem administradores as leem. Evite dado de saúde ou de terceiros, a menos que seja indispensável, e marque-o como sensível.</p>
      {!somenteLeitura && (
        <form className="stack-s" onSubmit={e => { e.preventDefault(); if (texto.trim()) criar.mutate(); }}>
          <label className="field"><span className="t-small-strong">Nova anotação</span><span className="input area"><textarea rows={3} maxLength={4000} value={texto} onChange={e => setTexto(e.target.value)} /></span></label>
          <label className="hrow t-small"><input type="checkbox" checked={sensivel} onChange={e => setSensivel(e.target.checked)} /> Contém dado sensível (saúde, família, situação financeira)</label>
          <div className="hrow"><Btn type="submit" sm disabled={!texto.trim() || criar.isPending}>Guardar anotação</Btn></div>
        </form>
      )}
      {!notas.length ? <p className="t-small muted">Nenhuma anotação ainda.</p> : (
        <ul className="notes">
          {notas.map(n => (
            <li key={n.id} className="note">
              {editando?.id === n.id ? (
                <form className="stack-s" onSubmit={e => { e.preventDefault(); if (editando.texto.trim()) salvar.mutate(); }}>
                  <span className="input area"><textarea rows={3} maxLength={4000} aria-label="Editar anotação" value={editando.texto} onChange={e => setEditando({ id: n.id, texto: e.target.value })} /></span>
                  <div className="hrow"><Btn type="submit" sm disabled={!editando.texto.trim() || salvar.isPending}>Salvar</Btn><Btn kind="g" sm onClick={() => setEditando(null)}>Cancelar</Btn></div>
                </form>
              ) : (
                <>
                  <p className="t-body" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
                  <div className="hrow wrap between">
                    <span className="t-small muted">{dataHora(n.created_at)}{n.updated_at !== n.created_at ? ' · editada' : ''}{n.sensitive && <> · <Pill tone="amber" icon={Lock}>sensível</Pill></>}</span>
                    {!somenteLeitura && <span className="hrow"><Btn kind="g" sm onClick={() => setEditando({ id: n.id, texto: n.body })}>Editar</Btn><button type="button" className="ibtn plain" aria-label="Apagar anotação" onClick={() => { if (window.confirm('Apagar esta anotação? Não dá para desfazer.')) apagar.mutate(n.id); }}><Trash2 size={16} aria-hidden /></button></span>}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {(criar.error || salvar.error || apagar.error) && <p className="t-small c-bad" role="alert">{((criar.error ?? salvar.error ?? apagar.error) as Error).message}</p>}
    </Card>
  );
}
