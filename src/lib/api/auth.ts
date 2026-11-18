import { request } from '@/lib/http';
import { getOrCreateFingerprint } from '@/lib/fingerprint';
import { clearSession, getAccessToken, getStoredUser, setAccessToken, setRefreshToken, setRemembered, setStoredUser } from '@/lib/session';

export type Papel = 'admin' | 'student' | 'mentor' | 'submentor';
export interface Usuario { id: string; email: string; role: Papel }

interface LoginResponse { access_token: string; refresh_token: string; user_id: string; email: string; role: Papel }

/** Quem entra no portal. Aluno não: o portal não é o learner. */
export const PAPEIS_DO_PORTAL: ReadonlyArray<Papel> = ['admin', 'mentor', 'submentor'];

export async function login(email: string, password: string, lembrar: boolean): Promise<Usuario> {
  // O mesmo identificador de aparelho do admin-hub (FingerprintJS dá o mesmo
  // valor nas duas origens): entrar no hub e no portal pelo mesmo navegador
  // não gasta duas vagas do limite de 2 dispositivos.
  const device_fingerprint = await getOrCreateFingerprint();
  setRemembered(lembrar);
  clearSession();
  const r = await request<LoginResponse>('/auth/login/', { method: 'POST', body: JSON.stringify({ email, password, device_fingerprint }) });
  if (!PAPEIS_DO_PORTAL.includes(r.role)) {
    throw new Error('Este portal é para mentores e administradores. Alunos entram pelo app do Residente de Elite.');
  }
  setAccessToken(r.access_token);
  setRefreshToken(r.refresh_token);
  const u: Usuario = { id: r.user_id, email: r.email, role: r.role };
  setStoredUser(JSON.stringify(u));
  return u;
}

export function usuarioSalvo(): Usuario | null {
  const raw = getStoredUser();
  if (!raw || !getAccessToken()) return null;
  try {
    const u = JSON.parse(raw) as Usuario;
    return PAPEIS_DO_PORTAL.includes(u.role) ? u : null;
  } catch {
    return null;
  }
}

export function logout() { clearSession(); }
