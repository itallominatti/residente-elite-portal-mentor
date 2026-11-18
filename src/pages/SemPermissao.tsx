import { ShieldAlert, Users } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Btn, Card, Empty } from '@/components/ui';

/** Aluno fora da carteira: o portal não mostra nada dele, nem o nome. A frase é a do servidor. */
export default function SemPermissao() {
  return (
    <Shell title="Sem acesso" back="/mentorandos">
      <Card className="empty-hero">
        <Empty icon={ShieldAlert} title="Você não atende este aluno" action={<Btn icon={Users} to="/mentorandos">Voltar para os mentorandos</Btn>}>
          Este mentorando não está nesta carteira, então o portal não mostra perfil, métricas nem conversas. A regra vale mesmo abrindo o endereço direto.
        </Empty>
      </Card>
    </Shell>
  );
}
