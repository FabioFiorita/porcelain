import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createMockApi } from './api/mock-api';
import { createMockStore } from './api/mock-store';
import { PrototypeControls } from './development/prototype-controls';
import { createQueryClient } from './query/client';
import { createConnectionStore } from './query/connection-store';
import { LiveChannel } from './query/live';
import { WorkspaceProvider } from './query/workspace-provider';
import { createAppRouter } from './routes/router';
import { PierreIconSprite } from './views/review/file-type-icon';
import { PreferencesProvider } from './views/workspace/preferences';
import './app.css';
import './pierre.css';

const Devtools = lazy(() =>
  import('./development/devtools').then((module) => ({
    default: module.Devtools,
  })),
);

const store = createMockStore();
const api = createMockApi(store);
const connection = createConnectionStore();
// A pairing error from any request brings back the pairing screen.
const queryClient = createQueryClient((error) =>
  connection.setPairing(
    error.code === 'DEVICE_REVOKED' ? 'revoked' : 'unpaired',
  ),
);
const router = createAppRouter();

const host = document.getElementById('root');
if (host == null) throw new Error('Missing #root');

// Same nesting as apps/web/src/main.tsx, with the mock api in place of the live one.
createRoot(host).render(
  <StrictMode>
    <PreferencesProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <WorkspaceProvider
            api={api}
            environmentId={store.environmentId}
            connection={connection}
          >
            <Toaster>
              <PierreIconSprite />
              <LiveChannel />
              <RouterProvider router={router} />
              <PrototypeControls store={store} />
              {import.meta.env.DEV && (
                <Suspense fallback={null}>
                  <Devtools router={router} />
                </Suspense>
              )}
            </Toaster>
          </WorkspaceProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </PreferencesProvider>
  </StrictMode>,
);
