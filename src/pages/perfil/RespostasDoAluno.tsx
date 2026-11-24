/**
 * Histórico geral das questões que o aluno respondeu, de todas as tentativas (inclusive modo estudo), do mais
 * recente ao mais antigo. Fica recolhido: o caminho principal é abrir uma PROVA (na ordem do simulado, com
 * alternativas e gabarito). Cada linha leva à prova de onde a resposta veio.
 */
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import { Btn, Card, ErrorBox, Loading, Pill } from '@/components/ui';
import { FonteDosNumeros } from '@/pages/perfil/partes';
import { getRespostas } from '@/lib/api/acompanhamento';
import { dataHora } from '@/lib/format';
import { textoPuro } from '@/lib/richText';

type Filtro = 'todas' | 'erradas' | 'certas';
const FILTROS: [Filtro, string][] = [['todas', 'Todas'], ['erradas', 'Erradas'], ['certas', 'Certas']];

export default function RespostasDoAluno({ alunoId, abrirProva }: { alunoId: string; abrirProva: (tentativaId: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [pagina, setPagina] = useState(1);
  const acerto = filtro === 'todas' ? undefined : filtro === 'certas';
  const q = useQuery({
    queryKey: ['respostas', alunoId, filtro, pagina], queryFn: () => getRespostas(alunoId, { pagina, acerto }),
    enabled: aberto, placeholderData: keepPreviousData, staleTime: 60_000,
  });
  const escolher = (f: Filtro) => { setFiltro(f); setPagina(1); };
  const d = q.data;
  return (
    <Card
      title="Histórico de questões" icon={ListChecks} sub={d ? `${d.total.toLocaleString('pt-BR')} respondidas` : 'todas as tentativas'}
      right={<Btn kind="g" sm icon={aberto ? ChevronDown : ChevronRight} onClick={() => setAberto(v => !v)}>{aberto ? 'Recolher' : 'Ver histórico'}</Btn>}
    >
      {!aberto ? <p className="t-small muted">Para ver uma prova inteira, na ordem do simulado e com o gabarito, use “Ver prova” em um simulado acima. Aqui fica a lista corrida de tudo o que o aluno respondeu, inclusive no modo estudo.</p> : (
        <>
          <div className="chips" role="group" aria-label="Filtrar por resultado">
            {FILTROS.map(([k, l]) => <button key={k} type="button" className={`chip${filtro === k ? ' on' : ''}`} aria-pressed={filtro === k} onClick={() => escolher(k)}>{l}</button>)}
          </div>
          {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !d?.results.length ? <p className="t-small muted">Nenhuma questão respondida com este filtro.</p> : (
            <>
              <div className="tbl-wrap"><table className="tbl" aria-label="Histórico de questões">
                <thead><tr><th>Questão</th><th>Simulado</th><th>Resultado</th><th className="r">Quando</th><th /></tr></thead>
                <tbody>
                  {d.results.map(r => (
                    <tr key={r.id}>
                      <td className="t-small" style={{ maxWidth: 380 }}>{textoPuro(r.enunciado, 130)}{r.area && <span className="muted"> · {r.area}</span>}</td>
                      <td className="t-small">{r.simulado}{!r.tentativa_finalizada && <span className="muted"> · em andamento</span>}</td>
                      <td>{r.acertou === null ? <Pill tone="muted">Sem resposta</Pill> : r.acertou ? <Pill tone="ok">Acertou</Pill> : <Pill tone="bad">Errou</Pill>}</td>
                      <td className="r t-small muted">{dataHora(r.respondida_em)}</td>
                      <td className="r"><Btn kind="g" sm onClick={() => abrirProva(r.tentativa_id)}>Ver prova</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <div className="hrow between">
                <span className="t-small muted">Página {d.pagina} de {d.total_de_paginas}</span>
                <span className="hrow"><Btn kind="s" sm onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}>Anteriores</Btn><Btn kind="s" sm onClick={() => setPagina(p => p + 1)} disabled={pagina >= d.total_de_paginas}>Próximas</Btn></span>
              </div>
            </>
          )}
          <FonteDosNumeros>Do mais recente para o mais antigo, de todas as tentativas.</FonteDosNumeros>
        </>
      )}
    </Card>
  );
}
