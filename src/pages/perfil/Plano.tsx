import { ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui';
import { MetaSemanal } from '@/pages/perfil/partes';
import { useEscopo } from '@/contexts/EscopoContext';

export default function Plano({ alunoId }: { alunoId: string }) {
  const { somenteLeitura } = useEscopo();
  return (
    <div className="cols">
      <div className="stack">
        <MetaSemanal alunoId={alunoId} somenteLeitura={somenteLeitura} />
      </div>
      <div className="stack">
        <Card title="Plano combinado" icon={ClipboardList} iconTone="muted">
          <p className="t-small muted">Objetivos com prazo, a prova-alvo e a pauta dos contatos dependem de um modelo novo no servidor (contatos, anotações e plano). A meta semanal ao lado é o que já existe: é o que o aluno vê no painel dele.</p>
        </Card>
      </div>
    </div>
  );
}
