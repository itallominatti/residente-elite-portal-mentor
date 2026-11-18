import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { Callout } from '@/components/ui';

export default function LoginPage() {
  const { user, entrar } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (user) return <Navigate to={user.role === 'admin' ? '/admin/mentores' : '/'} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null); setEnviando(true);
    try {
      const u = await entrar(email.trim(), senha, lembrar);
      nav(u.role === 'admin' ? '/admin/mentores' : '/', { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="app notabs">
      <main className="auth">
        <div className="auth-card">
          <img src={logo} alt="Residente de Elite" />
          <div className="stack-xs"><h1 className="t-h1">Portal do mentor</h1></div>
          {erro && <Callout icon={AlertCircle} tone="bad"><p className="t-small" role="alert">{erro}</p></Callout>}
          <form onSubmit={enviar} noValidate>
            <label className="field"><span className="t-small-strong">E-mail</span><span className="input"><input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></span></label>
            <label className="field"><span className="t-small-strong">Senha</span><span className="input"><input type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></span></label>
            <label className="hrow t-small"><input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)} /> Manter conectado neste navegador</label>
            <button className="btn btn-p full" type="submit" disabled={enviando || !email || !senha}>{enviando && <Loader2 size={16} className="spin" aria-hidden />}<span>Entrar</span></button>
          </form>
        </div>
      </main>
    </div>
  );
}
