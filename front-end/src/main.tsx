import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import './index.css';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <App />
          <Toaster richColors position='bottom-right' />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
