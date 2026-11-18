import { FUSO } from '@/config';

const valida = (iso: string | null | undefined) => { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; };

/** "há 3 min", "há 14 h", "há 3 d". */
export function haQuanto(iso: string | null | undefined, agora = Date.now()): string {
  const d = valida(iso); if (!d) return '';
  const min = Math.floor((agora - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
export const dataCurta = (iso: string | null | undefined) => valida(iso)?.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }) ?? '';
export const dataHora = (iso: string | null | undefined) => valida(iso)?.toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) ?? '';
export const hojeLongo = () => { const s = new Date().toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };

/** Dia `yyyy-MM-dd` em São Paulo, `deslocamento` dias a partir de hoje. */
export function diaSP(deslocamento = 0): string {
  const d = new Date(Date.now() + deslocamento * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: FUSO });
}

export const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '?';
const TONS = ['teal', 'amber', 'blue', 'violet', 'ok'] as const;
/** Cor estável por pessoa (a mesma em todas as telas). */
export function tomDe(id: string): (typeof TONS)[number] {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONS[h % TONS.length]!;
}
export function saudacao(d = new Date()): string {
  const h = Number(d.toLocaleTimeString('en-GB', { timeZone: FUSO, hour: '2-digit', hour12: false }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
