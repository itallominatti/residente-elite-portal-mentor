/**
 * Grade de calendário por horário (dia ou semana), no estilo do Google Calendar.
 *
 * - clicar num horário vazio cria (`aoClicarVazio`);
 * - clicar num evento abre o detalhe (`aoClicarEvento`);
 * - arrastar um evento para outro dia/horário o move (`aoMover`), com encaixe de 15 minutos. Só com mouse
 *   ou caneta: no toque o arraste brigaria com a rolagem, e o detalhe permite remarcar pelos campos;
 * - Esc cancela o arraste.
 * O componente só desenha e entrega gestos: quem grava (e confirma) é a tela.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  arredondar, diaDe, eventosDoDia, horaDoMinuto, limitar, MINUTOS_NO_DIA, minutoNoDia, NOME_DO_DIA, numeroDoDia, paraIso, PASSO_MIN, posicionar,
  type Dia, type EventoDoCalendario,
} from '@/lib/calendario';

export const ALTURA_DA_HORA = 52;
const PX_POR_MIN = ALTURA_DA_HORA / 60;
const LIMIAR_DO_ARRASTE_PX = 5;

interface Props<T> {
  dias: Dia[];
  eventos: EventoDoCalendario<T>[];
  hoje: Dia;
  /** `false` esconde a criação por clique (ex.: "ver como"). */
  podeCriar: boolean;
  aoClicarVazio: (iso: string) => void;
  aoClicarEvento: (e: EventoDoCalendario<T>) => void;
  aoMover: (e: EventoDoCalendario<T>, novoInicio: string) => void;
  aoClicarDia?: (dia: Dia) => void;
}

interface Arraste { id: string; dia: Dia; minuto: number; saiu: boolean }

export function Calendario<T>({ dias, eventos, hoje, podeCriar, aoClicarVazio, aoClicarEvento, aoMover, aoClicarDia }: Props<T>) {
  const rolagem = useRef<HTMLDivElement>(null);
  const colunas = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => new Date());
  const [arraste, setArraste] = useState<Arraste | null>(null);
  // O gesto em andamento fica num ref: os ouvintes da janela precisam do valor atual sem se reinscrever a cada movimento.
  const gesto = useRef<{ id: string; x: number; y: number; dia: Dia; minuto: number; moveu: boolean; evento: EventoDoCalendario<T> } | null>(null);
  const ultimo = useRef<Arraste | null>(null);
  const tipoDoPonteiro = useRef<string>('mouse');

  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  // Abre perto do horário que importa: o de agora (hoje) ou o começo do expediente.
  useLayoutEffect(() => {
    if (!rolagem.current) return;
    const foco = dias.includes(hoje) ? Math.max(0, minutoNoDia(new Date()) - 90) : 7 * 60;
    rolagem.current.scrollTop = foco * PX_POR_MIN;
  }, [dias[0], dias.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const porDia = useMemo(() => new Map(dias.map(d => [d, eventosDoDia(eventos, d)])), [dias, eventos]);
  const horas = Array.from({ length: 24 }, (_, h) => h);

  const posicoes = (dia: Dia) => {
    const evs = (porDia.get(dia) ?? []).map(e => {
      const sobre = arraste?.id === e.id ? arraste : null;
      return { id: e.id, inicioMin: sobre ? sobre.minuto : minutoNoDia(e.inicio), duracaoMin: e.duracaoMin };
    });
    return posicionar(evs);
  };

  // O evento arrastado aparece na coluna de destino, não na de origem.
  const eventosVisiveis = (dia: Dia) => {
    const da = porDia.get(dia) ?? [];
    const base = arraste ? da.filter(e => e.id !== arraste.id) : da;
    if (arraste && arraste.dia === dia) {
      const mov = eventos.find(e => e.id === arraste.id);
      if (mov) return [...base, mov];
    }
    return base;
  };

  const alvoDoPonteiro = (x: number, y: number): { dia: Dia; minuto: number; saiu: boolean } | null => {
    const g = gesto.current, caixa = colunas.current?.getBoundingClientRect();
    if (!g || !caixa) return null;
    const largura = caixa.width / dias.length;
    const idx = Math.max(0, Math.min(dias.length - 1, Math.floor((x - caixa.left) / largura)));
    const original = minutoNoDia(g.evento.inicio);
    const minuto = limitar(arredondar(original + (y - g.y) / PX_POR_MIN), 0, MINUTOS_NO_DIA - PASSO_MIN);
    return { dia: dias[idx]!, minuto, saiu: x < caixa.left - 40 || x > caixa.right + 40 };
  };

  const comecar = (e: ReactPointerEvent, ev: EventoDoCalendario<T>) => {
    tipoDoPonteiro.current = e.pointerType;
    if (e.button !== 0 || !ev.arrastavel || e.pointerType === 'touch') return;
    gesto.current = { id: ev.id, x: e.clientX, y: e.clientY, dia: diaDe(ev.inicio), minuto: minutoNoDia(ev.inicio), moveu: false, evento: ev };
    const mover = (m: PointerEvent) => {
      const g = gesto.current; if (!g) return;
      if (!g.moveu && Math.hypot(m.clientX - g.x, m.clientY - g.y) < LIMIAR_DO_ARRASTE_PX) return;
      g.moveu = true;
      const alvo = alvoDoPonteiro(m.clientX, m.clientY);
      if (alvo) { ultimo.current = { id: g.id, ...alvo }; setArraste(ultimo.current); }
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); window.removeEventListener('keydown', teclar);
      const g = gesto.current, alvo = ultimo.current;
      gesto.current = null; ultimo.current = null; setArraste(null);
      if (!g) return;
      if (!g.moveu) { aoClicarEvento(g.evento); return; }
      if (!alvo || alvo.saiu) return;
      const mudou = alvo.dia !== g.dia || alvo.minuto !== g.minuto;
      if (mudou) aoMover(g.evento, paraIso(alvo.dia, alvo.minuto));
    };
    const teclar = (k: globalThis.KeyboardEvent) => {
      if (k.key !== 'Escape') return;
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); window.removeEventListener('keydown', teclar);
      gesto.current = null; ultimo.current = null; setArraste(null);
    };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar); window.addEventListener('keydown', teclar);
  };

  const clicarNoVazio = (dia: Dia, e: React.MouseEvent<HTMLDivElement>) => {
    if (!podeCriar || e.target !== e.currentTarget) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    aoClicarVazio(paraIso(dia, Math.floor(y / PX_POR_MIN / 30) * 30));
  };

  const teclado = (e: KeyboardEvent, ev: EventoDoCalendario<T>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoClicarEvento(ev); } };
  const minutoAgora = minutoNoDia(agora);

  return (
    <div className="cal" role="grid" aria-label="Calendário">
      <div className="cal-head" style={{ gridTemplateColumns: `52px repeat(${dias.length}, 1fr)` }}>
        <span />
        {dias.map(d => (
          <button key={d} type="button" className={`cal-dia${d === hoje ? ' hoje' : ''}`} onClick={() => aoClicarDia?.(d)} disabled={!aoClicarDia} aria-label={`Ver o dia ${d}`}>
            <span className="cal-dia-n">{NOME_DO_DIA[new Date(`${d}T12:00:00-03:00`).getUTCDay()]}</span>
            <span className="cal-dia-d">{numeroDoDia(d)}</span>
          </button>
        ))}
      </div>
      <div className="cal-scroll" ref={rolagem}>
        <div className="cal-grid" style={{ height: 24 * ALTURA_DA_HORA }}>
          <div className="cal-horas" aria-hidden>
            {horas.map(h => <span key={h} style={{ top: h * ALTURA_DA_HORA }}>{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>)}
          </div>
          <div className="cal-cols" ref={colunas} style={{ gridTemplateColumns: `repeat(${dias.length}, 1fr)` }}>
            {dias.map(dia => {
              const evs = eventosVisiveis(dia);
              const pos = new Map(posicoes(dia).map(p => [p.id, p]));
              return (
                <div key={dia} className={`cal-col${dia === hoje ? ' hoje' : ''}${podeCriar ? ' cria' : ''}`} onClick={e => clicarNoVazio(dia, e)} role="gridcell" aria-label={dia}>
                  {dia === hoje && <i className="cal-agora" style={{ top: minutoAgora * PX_POR_MIN }} aria-hidden />}
                  {evs.map(ev => {
                    const p = pos.get(ev.id); if (!p) return null;
                    const mexendo = arraste?.id === ev.id;
                    const inicioMin = mexendo ? arraste.minuto : minutoNoDia(ev.inicio);
                    return (
                      <div
                        key={ev.id} role="button" tabIndex={0} aria-label={`${ev.titulo}, ${horaDoMinuto(inicioMin)}`}
                        className={`cal-ev cor-${ev.cor} t-${ev.tipo}${ev.concluido ? ' feito' : ''}${ev.arrastavel ? ' mov' : ''}${mexendo ? ' arrastando' : ''}${p.altura <= 32 ? ' curto' : ''}`}
                        style={{ top: p.topo * PX_POR_MIN, height: Math.max(p.altura * PX_POR_MIN - 2, 16), left: `calc(${(p.coluna / p.colunas) * 100}% + 1px)`, width: `calc(${100 / p.colunas}% - 3px)` }}
                        onPointerDown={e => comecar(e, ev)} onKeyDown={e => teclado(e, ev)} onClick={() => { if (!ev.arrastavel || tipoDoPonteiro.current === 'touch') aoClicarEvento(ev); }}
                      >
                        <span className="cal-ev-h">{horaDoMinuto(inicioMin)}</span>
                        <span className="cal-ev-t">{ev.titulo}</span>
                        {ev.subtitulo && p.altura >= 45 && <span className="cal-ev-s">{ev.subtitulo}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
