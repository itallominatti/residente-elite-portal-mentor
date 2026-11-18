/* Folha de formulário (a mesma do "ver como"): fecha com Esc e com clique fora. */
import { useEffect, useId, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Btn } from '@/components/ui';

interface Props {
  titulo: string;
  children: ReactNode;
  fechar: () => void;
  aoEnviar: () => void;
  enviar: string;
  enviando?: boolean;
  desabilitado?: boolean;
  erro?: unknown;
}

export function Sheet({ titulo, children, fechar, aoEnviar, enviar, enviando, desabilitado, erro }: Props) {
  const id = useId();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [fechar]);
  const submeter = (e: FormEvent) => { e.preventDefault(); aoEnviar(); };
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) fechar(); }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby={id} onSubmit={submeter}>
        <div className="grip" />
        <header className="sheet-h"><h2 className="t-title grow" id={id}>{titulo}</h2><button type="button" className="ibtn plain" aria-label="Fechar" onClick={fechar}><X size={18} aria-hidden /></button></header>
        <div className="sheet-b">
          {children}
          {erro != null && <p className="t-small c-bad" role="alert">{erro instanceof Error ? erro.message : 'Não foi possível salvar.'}</p>}
        </div>
        <footer className="sheet-f"><Btn kind="s" onClick={fechar}>Cancelar</Btn><Btn type="submit" disabled={desabilitado || enviando}>{enviar}</Btn></footer>
      </form>
    </div>
  );
}
