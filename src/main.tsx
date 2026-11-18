import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ApiError, ReadOnlyError } from '@/lib/http';
import App from '@/App';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';
import '@/styles/shell.css';
import '@/styles/screens.css';
import '@/styles/app.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // 4xx não melhora repetindo (403 "Você não atende este aluno", 404...).
      retry: (n, e) => !(e instanceof ReadOnlyError) && !(e instanceof ApiError && e.status < 500) && n < 2,
    },
    mutations: { retry: false },
  },
});

// API falsa só em desenvolvimento, e só se pedida: o `import.meta.env.DEV` some do build de produção.
if (import.meta.env.DEV && import.meta.env.VITE_MOCK_API === 'true') {
  const { instalarApiFalsa } = await import('@/mocks/api');
  instalarApiFalsa();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
