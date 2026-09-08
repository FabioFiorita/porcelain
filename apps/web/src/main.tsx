import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { TooltipProvider } from './components/ui/tooltip';
import './app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
