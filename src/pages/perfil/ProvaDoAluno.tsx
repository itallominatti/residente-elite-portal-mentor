/**
 * A prova de um aluno na ORDEM do simulado, como o admin-hub mostra: cada questão com o enunciado, a
 * categoria, o resultado, as alternativas (a que o aluno marcou e a certa) e o comentário.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, MinusCircle, XCircle } from 'lucide-react';
import { Btn, Card, ErrorBox, Loading, Pill } from '@/components/ui';
import { getProva, type QuestaoDaProva, type ResultadoDaQuestao } from '@/lib/api/acompanhamento';
import { dataHora } from '@/lib/format';
import { sanitizarTextoRico, textoPuro } from '@/lib/richText';

type Filtro = 'todas' | ResultadoDaQuestao;
const ROTULO: Record<Filtro, string> = { todas: 'Todas', errou: 'Erradas', acertou: 'Certas', em_branco: 'Em branco' };
const LETRAS = 'ABCDEFGHIJ';

/** Texto rico já sanitizado (a mesma lista do back-end e do admin-hub). */
const Rico = ({ html, className }: { html: string; className?: string }) => <div className={`rt${className ? ` ${className}` : ''}`} dangerouslySetInnerHTML={{ __html: sanitizarTextoRico(html) }} />;

function Icone({ r }: { r: ResultadoDaQuestao }) {
  if (r === 'acertou') return <CheckCircle2 size={18} className="c-ok" aria-label="Acertou" />;
  if (r === 'errou') return <XCircle size={18} className="c-bad" aria-label="Errou" />;
  return <MinusCircle size={18} className="muted" aria-label="Em branco" />;
}

export default function ProvaDoAluno({ alunoId, tentativaId, fechar }: { alunoId: string; tentativaId: string; fechar: () => void }) {
  const q = useQuery({ queryKey: ['prova', alunoId, tentativaId], queryFn: () => getProva(alunoId, tentativaId), staleTime: 5 * 60_000 });
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todas: 0, errou: 0, acertou: 0, em_branco: 0 };
    for (const x of q.data?.questoes ?? []) { c.todas++; c[x.resultado]++; }
    return c;
  }, [q.data]);

  const voltar = <Btn kind="s" sm onClick={fechar}>Voltar</Btn>;
  if (q.isLoading) return <Card title="Prova" right={voltar}><Loading>Carregando a prova…</Loading></Card>;
  if (q.error) return <Card title="Prova" right={voltar}><ErrorBox error={q.error} onRetry={() => q.refetch()} /></Card>;
  if (!q.data) return null;
  const { tentativa: t, questoes } = q.data;
  const visiveis = questoes.filter(x => filtro === 'todas' || x.resultado === filtro);
  const alternar = (id: string) => setAbertas(a => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todasAbertas = visiveis.length > 0 && visiveis.every(x => abertas.has(x.question_id));

  return (
    <Card
      title={t.simulado} icon={ClipboardCheck} right={voltar}
      sub={`${t.modo === 'study' ? 'modo estudo' : 'simulado'} · ${t.finalizada_em ? `finalizado em ${dataHora(t.finalizada_em)}` : `começou em ${dataHora(t.comecou_em)} e não terminou`}`}
    >
      <div className="hrow wrap">
        {t.nota !== null && <Pill tone={t.nota >= 70 ? 'ok' : t.nota >= 50 ? 'amber' : 'bad'}>Nota {t.nota.toFixed(1)}%</Pill>}
        <Pill tone="ok">{contagem.acertou} certas</Pill>
        <Pill tone="bad">{contagem.errou} erradas</Pill>
        {contagem.em_branco > 0 && <Pill tone="muted">{contagem.em_branco} em branco</Pill>}
        <span className="t-small muted">de {t.total_de_questoes} questões</span>
      </div>
      <div className="hrow wrap between">
        <div className="chips" role="group" aria-label="Filtrar por resultado">
          {(Object.keys(ROTULO) as Filtro[]).map(k => (k === 'em_branco' && !contagem.em_branco ? null : (
            <button key={k} type="button" className={`chip${filtro === k ? ' on' : ''}`} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{ROTULO[k]}<span className="n">{contagem[k]}</span></button>
          )))}
        </div>
        <Btn kind="g" sm onClick={() => setAbertas(todasAbertas ? new Set() : new Set(visiveis.map(x => x.question_id)))}>{todasAbertas ? 'Recolher todas' : 'Expandir todas'}</Btn>
      </div>
      {!visiveis.length ? <p className="t-small muted">Nenhuma questão com este filtro.</p> : (
        <ol className="prova">
          {visiveis.map(x => <Questao key={x.question_id} x={x} aberta={abertas.has(x.question_id)} alternar={() => alternar(x.question_id)} />)}
        </ol>
      )}
    </Card>
  );
}

function Questao({ x, aberta, alternar }: { x: QuestaoDaProva; aberta: boolean; alternar: () => void }) {
  return (
    <li className={`prova-q ${x.resultado}`}>
      <button type="button" className="prova-cab" onClick={alternar} aria-expanded={aberta}>
        {aberta ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
        <span className="prova-n">Q{x.numero}</span>
        <Icone r={x.resultado} />
        <span className="prova-resumo">{textoPuro(x.enunciado) || '(questão com imagem)'}</span>
        {x.anulada && <Pill tone="amber">Anulada</Pill>}
        {x.categoria && <span className="prova-cat t-small muted">{x.categoria}</span>}
      </button>
      {aberta && (
        <div className="prova-corpo">
          <Rico html={x.enunciado} />
          {x.tema && <p className="t-small muted">{x.tema}{x.subtema ? ` · ${x.subtema}` : ''}</p>}
          {x.anulada && <p className="t-small c-amber">Anulada pela banca: qualquer alternativa marcada conta como acerto. As cores seguem o gabarito gravado.</p>}
          {x.resultado === 'em_branco' && <p className="t-small muted">O aluno não respondeu esta questão.</p>}
          <ul className="prova-alts">
            {x.alternativas.map((a, i) => (
              <li key={a.id} className={`alt${a.correta ? ' certa' : ''}${a.marcada ? ' marcada' : ''}${a.marcada && !a.correta ? ' errada' : ''}`}>
                <span className="alt-l">{LETRAS[i] ?? i + 1}</span>
                <div className="alt-t">
                  <Rico html={a.texto} />
                  <span className="alt-tags">
                    {a.marcada && <Pill tone={a.correta ? 'ok' : 'bad'}>Marcada pelo aluno</Pill>}
                    {a.correta && <Pill tone="ok">Resposta certa</Pill>}
                  </span>
                  {a.explicacao && <Rico html={a.explicacao} className="alt-expl" />}
                </div>
              </li>
            ))}
          </ul>
          {x.comentario && <div className="prova-coment"><p className="t-small-strong">Comentário da questão</p><Rico html={x.comentario} /></div>}
        </div>
      )}
    </li>
  );
}
