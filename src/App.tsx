import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EscopoProvider, useEscopo } from '@/contexts/EscopoContext';
import { Loading } from '@/components/ui';
import LoginPage from '@/pages/LoginPage';
import { FEATURES } from '@/config';

const InicioPage = lazy(() => import('@/pages/InicioPage'));
const MentorandosPage = lazy(() => import('@/pages/MentorandosPage'));
const PerfilPage = lazy(() => import('@/pages/PerfilPage'));
const ConversasPage = lazy(() => import('@/pages/ConversasPage'));
const RadarPage = lazy(() => import('@/pages/RadarPage'));
const MentoresPage = lazy(() => import('@/pages/admin/MentoresPage'));
const MentorPage = lazy(() => import('@/pages/admin/MentorPage'));
const AuditoriaPage = lazy(() => import('@/pages/admin/AuditoriaPage'));
const RevisoesPage = lazy(() => import('@/pages/admin/RevisoesPage'));
const AgendaPage = lazy(() => import('@/pages/AgendaPage'));
const ElitinhoPage = lazy(() => import('@/pages/ElitinhoPage'));
const NaoEncontrada = lazy(() => import('@/pages/NaoEncontrada'));

function ExigeLogin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/entrar" replace state={{ de: loc.pathname }} />;
  return <>{children}</>;
}

/** Telas de carteira: o admin sem "ver como" (nem o segundo chapéu) vai para a lista de mentores. */
function ExigeCarteira({ children }: { children: ReactNode }) {
  const { mentorId } = useEscopo();
  if (mentorId === undefined) return <Navigate to="/admin/mentores" replace />;
  return <>{children}</>;
}

function SoAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { verComo } = useEscopo();
  if (!isAdmin) return <Navigate to="/" replace />;
  // Dentro do "ver como" o admin está na pele do mentor; o painel admin fica fora até sair.
  if (verComo) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <EscopoProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/" element={<ExigeLogin><ExigeCarteira><InicioPage /></ExigeCarteira></ExigeLogin>} />
            <Route path="/mentorandos" element={<ExigeLogin><ExigeCarteira><MentorandosPage /></ExigeCarteira></ExigeLogin>} />
            <Route path="/mentorandos/:id" element={<ExigeLogin><ExigeCarteira><PerfilPage /></ExigeCarteira></ExigeLogin>} />
            <Route path="/mentorandos/:id/:aba" element={<ExigeLogin><ExigeCarteira><PerfilPage /></ExigeCarteira></ExigeLogin>} />
            <Route path="/conversas" element={<ExigeLogin><ExigeCarteira><ConversasPage /></ExigeCarteira></ExigeLogin>} />
            <Route path="/conversas/:threadId" element={<ExigeLogin><ExigeCarteira><ConversasPage /></ExigeCarteira></ExigeLogin>} />
            <Route path="/radar" element={<ExigeLogin><ExigeCarteira><RadarPage /></ExigeCarteira></ExigeLogin>} />
            {FEATURES.elitinhoDoMentor && <Route path="/elitinho" element={<ExigeLogin><ExigeCarteira><ElitinhoPage /></ExigeCarteira></ExigeLogin>} />}
            {FEATURES.acompanhamento && <Route path="/agenda" element={<ExigeLogin><ExigeCarteira><AgendaPage /></ExigeCarteira></ExigeLogin>} />}
            {FEATURES.acompanhamento && <Route path="/admin/revisoes" element={<ExigeLogin><SoAdmin><RevisoesPage /></SoAdmin></ExigeLogin>} />}
            {FEATURES.acompanhamento && <Route path="/admin/auditoria" element={<ExigeLogin><SoAdmin><AuditoriaPage /></SoAdmin></ExigeLogin>} />}
            <Route path="/admin/mentores" element={<ExigeLogin><SoAdmin><MentoresPage /></SoAdmin></ExigeLogin>} />
            <Route path="/admin/mentores/:id" element={<ExigeLogin><SoAdmin><MentorPage /></SoAdmin></ExigeLogin>} />
            <Route path="*" element={<NaoEncontrada />} />
          </Routes>
        </Suspense>
      </EscopoProvider>
    </BrowserRouter>
  );
}
