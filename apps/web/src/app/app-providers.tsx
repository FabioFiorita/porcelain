import { StrictMode, type ReactNode } from 'react';
import { toast, Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { onCopyNotice } from '@/shared/workspace/copy';
import { WorkspaceProvider } from '@/app/workspace-provider';

onCopyNotice((notice) => toast.add(notice));

export function AppProviders({
  query,
  children,
}: {
  query: (app: ReactNode) => ReactNode;
  children: ReactNode;
}) {
  return (
    <StrictMode>
      <TooltipProvider>
        {query(
          <WorkspaceProvider>
            <Toaster>{children}</Toaster>
          </WorkspaceProvider>,
        )}
      </TooltipProvider>
    </StrictMode>
  );
}
