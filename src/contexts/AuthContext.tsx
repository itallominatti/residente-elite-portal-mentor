import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login as apiLogin, logout as apiLogout, usuarioSalvo, type Usuario } from '@/lib/api/auth';
import { onSessionExpired } from '@/lib/session';
import { INATIVIDADE_MS } from '@/config';

interface Auth {
  user: Usuario | null;
  isAdmin: boolean;
  entrar: (email: string, senha: string, lembrar: boolean) => Promise<Usuario>;
  sair: () => void;
}
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => usuarioSalvo());
  const qc = useQueryClient();

  const sair = useCallback(() => {
    apiLogout();
    try { sessionStorage.removeItem('ver_como'); sessionStorage.removeItem('modo_admin'); } catch { /* storage bloqueado */ }
    qc.clear();
    setUser(null);
  }, [qc]);

  useEffect(() => { onSessionExpired(sair); }, [sair]);

  // Uma hora sem interação encerra a sessão (mesma regra do admin-hub).
  useEffect(() => {
    if (!user) return;
    let t: ReturnType<typeof setTimeout>;
    const rearmar = () => { clearTimeout(t); t = setTimeout(sair, INATIVIDADE_MS); };
    const ev = ['mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];
    ev.forEach(e => window.addEventListener(e, rearmar, { passive: true }));
    rearmar();
    return () => { clearTimeout(t); ev.forEach(e => window.removeEventListener(e, rearmar)); };
  }, [user, sair]);

  const entrar = useCallback(async (email: string, senha: string, lembrar: boolean) => {
    const u = await apiLogin(email, senha, lembrar);
    qc.clear();
    setUser(u);
    return u;
  }, [qc]);

  const value = useMemo(() => ({ user, isAdmin: user?.role === 'admin', entrar, sair }), [user, entrar, sair]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
