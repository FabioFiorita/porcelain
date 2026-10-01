import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from './components/ui/toast';
import { TooltipProvider } from './components/ui/tooltip';
import './app.css';
import { createQueryClient } from '@/shared/query/client';
import { WorkspaceProvider } from './app/workspace-provider';
import { routeTree } from './routeTree.gen';

const queryClient = createQueryClient();
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider>
          <Toaster>
            <RouterProvider router={router} />
          </Toaster>
        </WorkspaceProvider>
      </QueryClientProvider>
    </TooltipProvider>
  </StrictMode>,
);
