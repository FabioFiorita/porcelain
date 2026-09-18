import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app.css';
import '@xyflow/react/dist/style.css';
import { App } from './app';
import { connectLab } from './lib/lab';

const dark = window.matchMedia('(prefers-color-scheme: dark)');
const theme = () =>
  document.documentElement.classList.toggle('dark', dark.matches);
theme();
dark.addEventListener('change', theme);

connectLab();
const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
