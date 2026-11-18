/**
 * De quem é a carteira que o portal mostra agora.
 *
 * - mentor e submentor: a própria; o servidor já recorta (`alunos_de`).
 * - admin, por padrão: nenhuma (ele vê a lista de mentores).
 * - admin em "ver como": a do mentor escolhido, SOMENTE LEITURA.
 * - admin com o segundo chapéu (`is_mentor`): a própria, com escrita.
 *
 * O admin já lê todos os alunos, conversas e o radar inteiro no hub hoje; o
 * "ver como" só recorta esses dados pela carteira de um mentor. Não amplia o
 * que ele vê. A trilha por recurso ainda depende do servidor (docs/BACKEND.md).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { setReadOnly } from '@/lib/http';
import { VER_COMO_EXPIRA_MS } from '@/config';

export interface VerComo { mentorId: string; mentorNome: string; motivo: string; detalhe: string; desde: string }
type ModoAdmin = 'painel' | 'minha-carteira';

interface Escopo {
  /** `undefined` = sem carteira (admin no painel). `null` = a do próprio usuário, recortada pelo servidor. */
  mentorId: string | null | undefined;
  verComo: VerComo | null;
  somenteLeitura: boolean;
  modoAdmin: ModoAdmin;
  entrarVerComo: (v: Omit<VerComo, 'desde'>) => void;
  sairVerComo: () => void;
  usarMinhaCarteira: (on: boolean) => void;
}
const Ctx = createContext<Escopo | null>(null);

const ler = <T,>(k: string): T | null => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const gravar = (k: string, v: unknown) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage bloqueado */ } };

export function EscopoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [verComo, setVerComo] = useState<VerComo | null>(() => ler<VerComo>('ver_como'));
  const [modoAdmin, setModoAdmin] = useState<ModoAdmin>(() => ler<ModoAdmin>('modo_admin') ?? 'painel');
  const admin = user?.role === 'admin';
  const ativo = admin ? verComo : null;

  useEffect(() => { setReadOnly(!!ativo); }, [ativo]);

  const sairVerComo = useCallback(() => { setVerComo(null); gravar('ver_como', null); }, []);
  const entrarVerComo = useCallback((v: Omit<VerComo, 'desde'>) => {
    const novo = { ...v, desde: new Date().toISOString() };
    setVerComo(novo); gravar('ver_como', novo);
    setModoAdmin('painel'); gravar('modo_admin', 'painel');
  }, []);
  const usarMinhaCarteira = useCallback((on: boolean) => {
    const m: ModoAdmin = on ? 'minha-carteira' : 'painel';
    setModoAdmin(m); gravar('modo_admin', m);
    if (on) sairVerComo();
  }, [sairVerComo]);

  // "Ver como" esquecido numa aba não fica aberto: 30 min sem uso encerram.
  useEffect(() => {
    if (!ativo) return;
    let t: ReturnType<typeof setTimeout>;
    const rearmar = () => { clearTimeout(t); t = setTimeout(sairVerComo, VER_COMO_EXPIRA_MS); };
    const ev = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    ev.forEach(e => window.addEventListener(e, rearmar, { passive: true }));
    rearmar();
    return () => { clearTimeout(t); ev.forEach(e => window.removeEventListener(e, rearmar)); };
  }, [ativo, sairVerComo]);

  const mentorId = !user ? undefined : !admin ? null : ativo ? ativo.mentorId : modoAdmin === 'minha-carteira' ? user.id : undefined;
  const value = useMemo<Escopo>(() => ({
    mentorId, verComo: ativo, somenteLeitura: !!ativo, modoAdmin, entrarVerComo, sairVerComo, usarMinhaCarteira,
  }), [mentorId, ativo, modoAdmin, entrarVerComo, sairVerComo, usarMinhaCarteira]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEscopo(): Escopo {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEscopo fora do EscopoProvider');
  return c;
}
