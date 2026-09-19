import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from './components/ui/toast';
import { TooltipProvider } from './components/ui/tooltip';
import { createAppRouter } from './routes/router';
import './app.css';
import { createBootApi } from './api/boot';
import { createQueryClient } from './query/client';
import { WorkspaceProvider } from './query/workspace-provider';
import { PierreIconSprite } from './views/review/file-type-icon';
import { PierreWorkers } from './views/review/pierre-workers';
import './pierre.css';

const queryClient = createQueryClient();
const api = await createBootApi();
const router = createAppRouter();

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider api={api}>
          <Toaster>
            <PierreIconSprite />
            <PierreWorkers>
              <RouterProvider router={router} />
            </PierreWorkers>
          </Toaster>
        </WorkspaceProvider>
      </QueryClientProvider>
    </TooltipProvider>
  </StrictMode>,
);
