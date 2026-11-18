/* Trilha do "ver como": quem entrou na carteira de quem, por quê, por quanto tempo e o que abriu. Só admin. */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, ShieldCheck } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Btn, Callout, Card, ErrorBox, Loading, PageHead, Pill } from '@/components/ui';
import { getSessaoDaTrilha, getTrilha, rotuloDaRota, rotuloDoMotivo, type LinhaDaTrilha } from '@/lib/api/acompanhamento';
import { dataHora } from '@/lib/format';

const duracao = (s: LinhaDaTrilha) => {
  const fim = Date.parse(s.ended_at ?? s.last_seen_at), min = Math.max(0, Math.round((fim - Date.parse(s.started_at)) / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};

export default function AuditoriaPage() {
  const [aberta, setAberta] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['trilha'], queryFn: () => getTrilha() });
  return (
    <Shell title="Auditoria">
      <PageHead title="Auditoria do “ver como”" sub="Cada entrada na carteira de um mentor, com o motivo e o que foi aberto. O conteúdo das telas não é guardado, só a rota e o aluno." />
      <Callout icon={ShieldCheck} tone="violet"><p className="t-small">Mostra as 200 sessões mais recentes. Anotações privadas dos mentores não estão acessíveis em nenhuma sessão.</p></Callout>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (
        <Card flush>
          <div className="tbl-wrap"><table className="tbl" aria-label="Sessões de ver como">
            <thead><tr><th>Quando</th><th>Administrador</th><th>Mentor visto</th><th>Motivo</th><th className="r">Duração</th><th className="r">Acessos</th><th /></tr></thead>
            <tbody>
              {(q.data ?? []).map(s => (
                <FragmentoDaSessao key={s.id} s={s} aberta={aberta === s.id} alternar={() => setAberta(a => (a === s.id ? null : s.id))} />
              ))}
            </tbody>
          </table></div>
          {!q.data?.length && <p className="empty-row t-body muted">Nenhuma sessão de “ver como” ainda.</p>}
        </Card>
      )}
    </Shell>
  );
}

function FragmentoDaSessao({ s, aberta, alternar }: { s: LinhaDaTrilha; aberta: boolean; alternar: () => void }) {
  return (
    <>
      <tr>
        <td className="t-small">{dataHora(s.started_at)}{!s.ended_at && <> <Pill tone="amber">sem encerrar</Pill></>}</td>
        <td className="t-strong">{s.admin_name}</td>
        <td>{s.mentor_name}</td>
        <td className="t-small">{rotuloDoMotivo(s.reason)}{s.detail && <span className="muted"> · {s.detail}</span>}</td>
        <td className="r t-small">{duracao(s)}</td>
        <td className="r num">{s.accesses}</td>
        <td className="r"><Btn kind="g" sm icon={Eye} onClick={alternar}>{aberta ? 'Ocultar' : 'Ver acessos'}</Btn></td>
      </tr>
      {aberta && <tr><td colSpan={7}><Acessos id={s.id} /></td></tr>}
    </>
  );
}

function Acessos({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['trilha', id], queryFn: () => getSessaoDaTrilha(id) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const eventos = q.data?.events ?? [];
  if (!eventos.length) return <p className="t-small muted">Nenhuma tela foi aberta nesta sessão.</p>;
  return (
    <ul className="resumo-lines">
      {eventos.map((e, i) => <li key={i}>{dataHora(e.at)} · {rotuloDaRota(e.route)}{e.student_name && <> · {e.student_name}</>}</li>)}
    </ul>
  );
}
