import { AtomRegistry } from 'effect/reactivity';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import './app.css';
import { AppProviders } from './app/app-providers';
import { startAgentBridge } from './components/ui/agent-bridge';
import { routeTree } from './routeTree.gen';

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

await startAgentBridge();

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <AppProviders registry={registry}>
    <RouterProvider router={router} />
  </AppProviders>,
);
