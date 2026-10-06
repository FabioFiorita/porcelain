import { QueryClientProvider } from '@tanstack/react-query';
import { AtomRegistry } from 'effect/reactivity';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import './app.css';
import { createQueryClient } from '@/shared/query/client';
import { AppProviders } from './app/app-providers';
import { routeTree } from './routeTree.gen';

const queryClient = createQueryClient();
const registry = AtomRegistry.make();
const router = createRouter({
  routeTree,
  context: { registry },
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
  <AppProviders
    registry={registry}
    query={(app) => (
      <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>
    )}
  >
    <RouterProvider router={router} />
  </AppProviders>,
);
