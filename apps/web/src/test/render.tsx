import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { createMockStore } from '../api/inventory/mock';
import { createMockApi } from '../api/mock-api';
import { TooltipProvider } from '../components/ui/tooltip';
import { createQueryClient } from '../query/client';
import { WorkspaceProvider } from '../query/workspace-provider';
import { createAppRouter } from '../routes/router';

export function renderWorkspace(store = createMockStore()) {
  const api = createMockApi(store);
  const queryClient = createQueryClient();
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: ['/'] }),
  );
  const result = render(
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider api={api}>
          <RouterProvider router={router} />
        </WorkspaceProvider>
      </QueryClientProvider>
    </TooltipProvider>,
  );
  return { ...result, store, queryClient };
}
