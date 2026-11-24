/* Revisões dos alunos: o admin vê e remarca, num calendário, as revisões de qualquer mentor. */
import { useState } from 'react';
import { Info } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PainelDoCalendario } from '@/components/PainelDoCalendario';
import { Callout, ErrorBox, Loading, PageHead } from '@/components/ui';
import { useArvore } from '@/hooks/useCarteira';

export default function RevisoesPage() {
  const arvore = useArvore();
  const [mentor, setMentor] = useState('');
  const mentores = [...(arvore.data?.mentors ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
  return (
    <Shell title="Revisões dos alunos">
      <PageHead title="Revisões dos alunos" sub="Veja as revisões agendadas e arraste para outro dia e horário. O aluno vê a nova data na agenda dele." />
      <Callout icon={Info} tone="violet"><p className="t-small">Cada remarcação fica registrada (quem, de quando para quando). Remarcar aqui não conta como adiamento do aluno.</p></Callout>
      <div className="cal-barra">
        <span className="t-small-strong">Mentor</span>
        <span className="input" style={{ maxWidth: 320 }}>
          <select aria-label="Filtrar por mentor" value={mentor} onChange={e => setMentor(e.target.value)}>
            <option value="">Todos os mentores</option>
            {mentores.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </span>
      </div>
      {arvore.isLoading ? <Loading /> : arvore.error ? <ErrorBox error={arvore.error} onRetry={() => arvore.refetch()} /> : (
        <PainelDoCalendario key={mentor} comPendencias={false} mentorId={mentor || undefined} somenteLeitura={false} />
      )}
    </Shell>
  );
}
