import { Compass } from 'lucide-react';
import { Btn, Empty } from '@/components/ui';

export default function NaoEncontrada() {
  return (
    <div className="app notabs"><main className="auth"><div className="auth-card">
      <Empty icon={Compass} title="Página não encontrada" action={<Btn to="/">Ir para o início</Btn>}>O endereço não existe no portal do mentor.</Empty>
    </div></main></div>
  );
}
