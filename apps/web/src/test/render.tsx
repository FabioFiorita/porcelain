import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from 'vitest-browser-react';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import { TooltipProvider } from '../components/ui/tooltip';
import { createQueryClient } from '../query/client';
import { WorkspaceProvider } from '../query/workspace-provider';
import { createAppRouter } from '../routes/router';

export async function renderWorkspace(store = createMockStore()) {
  const api = createMockApi(store);
  const queryClient = createQueryClient();
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: ['/'] }),
  );
  const screen = await render(
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider api={api}>
          <RouterProvider router={router} />
        </WorkspaceProvider>
      </QueryClientProvider>
    </TooltipProvider>,
  );
  return { ...screen, store, queryClient };
}
