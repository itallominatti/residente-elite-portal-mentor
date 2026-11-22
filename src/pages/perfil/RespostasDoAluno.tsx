/* As questões que o aluno respondeu: enunciado resumido, área, simulado e se acertou. Sem gabarito nem comentário. */
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ListChecks, X } from 'lucide-react';
import { Btn, Card, ErrorBox, Loading, Pill } from '@/components/ui';
import { FonteDosNumeros } from '@/pages/perfil/partes';
import { getRespostas } from '@/lib/api/acompanhamento';
import { dataHora } from '@/lib/format';

type Filtro = 'todas' | 'erradas' | 'certas';
const FILTROS: [Filtro, string][] = [['todas', 'Todas'], ['erradas', 'Erradas'], ['certas', 'Certas']];

export interface SimuladoEmFoco { id: string; titulo: string }

export default function RespostasDoAluno({ alunoId, simulado, limparSimulado }: { alunoId: string; simulado: SimuladoEmFoco | null; limparSimulado: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [pagina, setPagina] = useState(1);
  const acerto = filtro === 'todas' ? undefined : filtro === 'certas';
  const q = useQuery({
    queryKey: ['respostas', alunoId, filtro, simulado?.id ?? null, pagina],
    queryFn: () => getRespostas(alunoId, { pagina, acerto, tentativaId: simulado?.id }),
    placeholderData: keepPreviousData, staleTime: 60_000,
  });
  const escolher = (f: Filtro) => { setFiltro(f); setPagina(1); };
  const d = q.data;
  return (
    <Card
      title="Questões respondidas" icon={ListChecks}
      sub={d ? `${d.total.toLocaleString('pt-BR')} ${simulado ? `em ${simulado.titulo}` : 'no total'}` : undefined}
    >
      <div className="hrow wrap between">
        <div className="chips" role="group" aria-label="Filtrar por resultado">
          {FILTROS.map(([k, l]) => <button key={k} type="button" className={`chip${filtro === k ? ' on' : ''}`} aria-pressed={filtro === k} onClick={() => escolher(k)}>{l}</button>)}
        </div>
        {simulado && <button type="button" className="chip on" onClick={() => { limparSimulado(); setPagina(1); }}>Simulado: {simulado.titulo} <X size={13} aria-hidden /></button>}
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !d?.results.length ? <p className="t-small muted">Nenhuma questão respondida com este filtro.</p> : (
        <>
          <div className="tbl-wrap"><table className="tbl" aria-label="Questões respondidas">
            <thead><tr><th>Questão</th><th>Área e tema</th><th>Simulado</th><th>Resultado</th><th className="r">Quando</th></tr></thead>
            <tbody>
              {d.results.map(r => (
                <tr key={r.id}>
                  <td className="t-small" style={{ maxWidth: 420 }}>{r.enunciado}</td>
                  <td className="t-small">{r.area ?? '—'}{r.tema && <span className="muted"> · {r.tema}</span>}</td>
                  <td className="t-small">{r.simulado}{!r.tentativa_finalizada && <span className="muted"> · em andamento</span>}</td>
                  <td>{r.acertou === null ? <Pill tone="muted">Sem resposta</Pill> : r.acertou ? <Pill tone="ok">Acertou</Pill> : <Pill tone="bad">Errou</Pill>}</td>
                  <td className="r t-small muted">{dataHora(r.respondida_em)}</td>
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
      <FonteDosNumeros>Do mais recente para o mais antigo. O enunciado vem resumido; o gabarito, as alternativas e o comentário da questão não aparecem aqui.</FonteDosNumeros>
    </Card>
  );
}
