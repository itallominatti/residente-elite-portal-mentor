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
 * que ele vê. Com `FEATURES.acompanhamento` o "ver como" é uma sessão no
 * servidor (motivo, 30 min sem uso, somente leitura, trilha por acesso) e a
 * sessão vai no cabeçalho `X-Ver-Como` de toda requisição (`lib/http.ts`).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { aoServidorEncerrarVerComo, setReadOnly, setVerComoSessao } from '@/lib/http';
import { abrirVerComo, encerrarVerComo, type MotivoDoVerComo } from '@/lib/api/acompanhamento';
import { FEATURES, VER_COMO_EXPIRA_MS } from '@/config';

export interface VerComo { mentorId: string; mentorNome: string; motivo: string; detalhe: string; desde: string; sessaoId?: string }
/** O que a tela manda para abrir: o motivo em código (o servidor valida) e o rótulo para a faixa de aviso. */
export interface PedidoDeVerComo { mentorId: string; mentorNome: string; motivo: MotivoDoVerComo; motivoRotulo: string; detalhe: string }
type ModoAdmin = 'painel' | 'minha-carteira';

interface Escopo {
  /** `undefined` = sem carteira (admin no painel). `null` = a do próprio usuário, recortada pelo servidor. */
  mentorId: string | null | undefined;
  verComo: VerComo | null;
  somenteLeitura: boolean;
  modoAdmin: ModoAdmin;
  /** Abre a sessão no servidor (com a função ligada) e entra. Rejeita com a frase do servidor se ele recusar. */
  entrarVerComo: (v: PedidoDeVerComo) => Promise<void>;
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
  const verComoRef = useRef<VerComo | null>(verComo);
  verComoRef.current = verComo;

  useEffect(() => { setReadOnly(!!ativo); setVerComoSessao(ativo?.sessaoId ?? null); }, [ativo]);

  const sairVerComo = useCallback(() => {
    const sessaoId = verComoRef.current?.sessaoId;
    verComoRef.current = null;
    setVerComoSessao(null);
    setVerComo(null); gravar('ver_como', null);
    // Avisa o servidor, sem esperar: se falhar, a sessão vence sozinha em 30 min.
    if (sessaoId) void encerrarVerComo(sessaoId).catch(() => undefined);
  }, []);
  const entrarVerComo = useCallback(async (v: PedidoDeVerComo) => {
    // Com a função ligada, a sessão nasce no servidor; recusa (motivo faltando, alvo inválido) sobe para a tela.
    const sessao = FEATURES.acompanhamento ? await abrirVerComo(v.mentorId, v.motivo, v.detalhe) : null;
    const novo: VerComo = { mentorId: v.mentorId, mentorNome: v.mentorNome, motivo: v.motivoRotulo, detalhe: v.detalhe, desde: new Date().toISOString(), sessaoId: sessao?.id };
    verComoRef.current = novo;
    setVerComoSessao(novo.sessaoId ?? null);
    setVerComo(novo); gravar('ver_como', novo);
    setModoAdmin('painel'); gravar('modo_admin', 'painel');
  }, []);
  const usarMinhaCarteira = useCallback((on: boolean) => {
    const m: ModoAdmin = on ? 'minha-carteira' : 'painel';
    setModoAdmin(m); gravar('modo_admin', m);
    if (on) sairVerComo();
  }, [sairVerComo]);

  // O servidor encerrou a sessão (venceu, ou foi fechada em outra aba): a tela sai junto, sem esperar o relógio dela.
  useEffect(() => {
    aoServidorEncerrarVerComo(() => { verComoRef.current = null; setVerComoSessao(null); setVerComo(null); gravar('ver_como', null); });
    return () => aoServidorEncerrarVerComo(null);
  }, []);

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
