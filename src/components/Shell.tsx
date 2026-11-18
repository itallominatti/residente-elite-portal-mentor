import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Sparkles, Eye, ExternalLink, House, Lock, LogOut, MessageSquare, Radar, ScrollText, Users, UsersRound, Briefcase, type LucideProps } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { useEscopo } from '@/contexts/EscopoContext';
import { useArvore, useCarteira } from '@/hooks/useCarteira';
import { Avatar, Btn } from '@/components/ui';
import { hojeLongo } from '@/lib/format';
import { listarPendencias } from '@/lib/api/acompanhamento';
import { pedemAtencao } from '@/lib/agenda';
import { FEATURES } from '@/config';

type Icon = ComponentType<LucideProps>;
interface Item { label: string; to: string; icon: Icon; badge?: number; bad?: boolean; ai?: boolean; off?: boolean }

/** Nome de quem está logado (a árvore traz `full_name`; o login só traz o e-mail). */
export function useNomeDoUsuario(): string {
  const { user } = useAuth();
  const { data } = useArvore();
  if (!user) return '';
  for (const m of data?.mentors ?? []) {
    if (m.id === user.id) return m.full_name;
    const s = m.submentores.find(x => x.id === user.id);
    if (s) return s.full_name;
  }
  return user.email;
}

export function Shell({ title, sub, back, children, noTabs }: { title: string; sub?: ReactNode; back?: string; children: ReactNode; noTabs?: boolean }) {
  const { user, isAdmin, sair } = useAuth();
  const { mentorId, verComo, sairVerComo, modoAdmin, usarMinhaCarteira } = useEscopo();
  const nome = useNomeDoUsuario();
  const { data: arvore } = useArvore();
  const nav = useNavigate();
  const temCarteira = mentorId !== undefined;
  const { contagem } = useCarteira();
  const viewas = !!verComo;
  // A agenda é de quem a escreve: em "ver como" ela seria a do administrador, então nem aparece.
  const agenda = useQuery({ queryKey: ['pendencias'], queryFn: () => listarPendencias(), enabled: FEATURES.acompanhamento && temCarteira && !viewas, refetchInterval: 120_000 });
  const naAgenda = agenda.data ? pedemAtencao(agenda.data) : 0;
  const souMentorTambem = isAdmin && !!arvore?.mentors.some(m => m.id === user?.id && m.is_mentor);

  const grupos: [string | null, Item[]][] = temCarteira ? [
    [null, [{ label: 'Início', to: '/', icon: House }]],
    ['Carteira', [
      { label: 'Mentorandos', to: '/mentorandos', icon: Users, badge: contagem.total || undefined },
      { label: 'Radar', to: '/radar', icon: Radar, badge: contagem.alerta + contagem.atencao || undefined },
    ]],
    ['Comunicação', [{ label: 'Conversas', to: '/conversas', icon: MessageSquare, badge: contagem.esperando || undefined, bad: true }, ...(FEATURES.elitinhoDoMentor && !viewas ? [{ label: 'Elitinho', to: '/elitinho', icon: Sparkles, ai: true }] : [])]],
    ...(FEATURES.acompanhamento && !viewas ? [['Meu dia', [{ label: 'Agenda', to: '/agenda', icon: CalendarClock, badge: naAgenda || undefined }]] as [string, Item[]]] : []),
  ] : [
    [null, [{ label: 'Mentores', to: '/admin/mentores', icon: UsersRound }, ...(FEATURES.acompanhamento ? [{ label: 'Auditoria', to: '/admin/auditoria', icon: ScrollText }] : [])]],
  ];

  const sairDoVerComo = () => { const id = verComo?.mentorId; sairVerComo(); nav(id ? `/admin/mentores/${id}` : '/admin/mentores'); };
  const papel = viewas ? 'Visão do administrador' : user?.role === 'admin' ? (modoAdmin === 'minha-carteira' ? 'Admin · minha carteira' : 'Administrador') : user?.role === 'submentor' ? 'Submentor' : 'Mentor';
  const quem = viewas ? verComo!.mentorNome : nome;

  const tabs: Item[] = temCarteira ? [
    { label: 'Início', to: '/', icon: House }, { label: 'Alunos', to: '/mentorandos', icon: Users },
    { label: 'Conversas', to: '/conversas', icon: MessageSquare, badge: contagem.esperando || undefined }, { label: 'Radar', to: '/radar', icon: Radar },
  ] : [];

  return (
    <div className={`app${viewas ? ' viewas' : ''}${noTabs || !tabs.length ? ' notabs' : ''}`}>
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>
      {viewas && (
        <div className="viewas-bar" role="status">
          <Eye size={20} aria-hidden />
          <div className="vb-t"><b>Você está vendo o portal como {verComo!.mentorNome}</b> · somente leitura<span className="d-only"> · motivo: {verComo!.motivo}</span></div>
          <span className="vb-pills"><span className="lock-note" style={{ background: 'rgba(255,255,255,.5)' }}><Lock size={12} aria-hidden />Somente leitura</span></span>
          <Btn sm icon={LogOut} onClick={sairDoVerComo}>Sair</Btn>
        </div>
      )}
      <div className="frame">
        <aside className="sb" aria-label="Menu do portal">
          <Link className="sb-logo" to={temCarteira ? '/' : '/admin/mentores'}><img src={logo} alt="Residente de Elite" /><span className="t-label">{temCarteira ? 'Portal do mentor' : 'Portal · admin'}</span></Link>
          <div className="sb-me"><Avatar nome={quem || '?'} id={viewas ? verComo!.mentorId : user?.id} size={34} /><span className="grow"><span className="t-strong trunc" style={{ display: 'block' }}>{quem}</span><span className="t-small muted trunc" style={{ display: 'block' }}>{papel}</span></span></div>
          {grupos.map(([g, items]) => (
            <div key={g ?? 'topo'}>
              {g && <div className="sb-g">{g}</div>}
              {items.map(i => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `sb-i${isActive ? ' on' : ''}${i.ai ? ' ai' : ''}${i.off ? ' off' : ''}`} aria-disabled={i.off || undefined} tabIndex={i.off ? -1 : undefined}>
                  <i.icon size={18} aria-hidden /><span>{i.label}</span>
                  {i.off ? <Lock size={13} aria-hidden /> : i.badge ? <span className={`badge${i.bad ? ' bad' : ''}`}>{i.badge}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="sb-foot">
            {viewas && <div className="sb-admin"><span className="t-label" style={{ color: 'var(--viewas)' }}>Modo admin</span><button type="button" className="sb-i" style={{ padding: '6px 4px', color: 'var(--viewas)' }} onClick={sairDoVerComo}><LogOut size={16} aria-hidden /><span>Sair do modo “ver como”</span></button></div>}
            {isAdmin && !viewas && souMentorTambem && (modoAdmin === 'minha-carteira'
              ? <button type="button" className="sb-i" onClick={() => { usarMinhaCarteira(false); nav('/admin/mentores'); }}><ArrowLeft size={18} aria-hidden /><span>Voltar ao painel admin</span></button>
              : <button type="button" className="sb-i" onClick={() => { usarMinhaCarteira(true); nav('/'); }}><Briefcase size={18} aria-hidden /><span>Minha carteira</span></button>)}
            {isAdmin && <a className="sb-i dim" href="https://admin.residente-elite.com" target="_blank" rel="noreferrer"><ExternalLink size={18} aria-hidden /><span>Abrir o admin-hub</span></a>}
            <button type="button" className="sb-i dim" onClick={sair}><LogOut size={18} aria-hidden /><span>Sair</span></button>
          </div>
        </aside>
        <div className="main">
          <header className={`mtop${back ? ' mback' : ''}`}>
            {back && <Link className="ibtn plain" to={back} aria-label="Voltar"><ArrowLeft size={18} aria-hidden /></Link>}
            <span className="grow"><h1 className={back ? 't-title trunc' : undefined}>{title}</h1>{sub && <span className="sub">{sub}</span>}</span>
            <button type="button" className="av-btn" onClick={sair} aria-label="Sair da conta"><Avatar nome={nome || user?.email || '?'} id={user?.id} size={32} /></button>
          </header>
          <header className="dtop"><span className="t-small muted">{hojeLongo()}</span><span className="grow" /></header>
          <main className="content" id="conteudo" tabIndex={-1}>{children}</main>
        </div>
        {tabs.length > 0 && !noTabs && (
          <nav className="tabbar" aria-label="Navegação principal" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map(t => (
              <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
                <t.icon size={21} aria-hidden /><span>{t.label}</span>{t.badge ? <span className="badge bad">{t.badge}</span> : null}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
