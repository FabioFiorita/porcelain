import { RegistryContext } from '@effect/atom-react';
import type { AtomRegistry } from 'effect/reactivity';
import { StrictMode, type ReactNode } from 'react';
import { toast, Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { onCopyNotice } from '@/shared/workspace/copy';
import { WorkspaceProvider } from '@/app/workspace-provider';

onCopyNotice((notice) => toast.add(notice));

export function AppProviders({
  query,
  registry,
  children,
}: {
  query: (app: ReactNode) => ReactNode;
  registry: AtomRegistry.AtomRegistry;
  children: ReactNode;
}) {
  return (
    <StrictMode>
      <RegistryContext.Provider value={registry}>
        <TooltipProvider>
          {query(
            <WorkspaceProvider>
              <Toaster>{children}</Toaster>
            </WorkspaceProvider>,
          )}
        </TooltipProvider>
      </RegistryContext.Provider>
    </StrictMode>
  );
}
