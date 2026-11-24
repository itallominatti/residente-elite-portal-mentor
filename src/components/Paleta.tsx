/* Seletor de cor do calendário: oito tons e "padrão" (a cor do tipo). */
import { CORES, ROTULO_DA_COR } from '@/lib/calendario';

export function Paleta({ valor, aoEscolher, desabilitado }: { valor: string | null; aoEscolher: (cor: string | null) => void; desabilitado?: boolean }) {
  return (
    <div className="paleta" role="radiogroup" aria-label="Cor no calendário">
      <button type="button" role="radio" aria-checked={!valor} aria-label="Cor padrão" title="Padrão" className={`padrao${!valor ? ' on' : ''}`} onClick={() => aoEscolher(null)} disabled={desabilitado} />
      {CORES.map(c => (
        <button key={c} type="button" role="radio" aria-checked={valor === c} aria-label={ROTULO_DA_COR[c]} title={ROTULO_DA_COR[c]} className={`cor-${c}${valor === c ? ' on' : ''}`} onClick={() => aoEscolher(c)} disabled={desabilitado} />
      ))}
    </div>
  );
}
