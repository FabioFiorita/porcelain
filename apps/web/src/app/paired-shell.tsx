import { useState, type ReactNode } from 'react';
import { ProjectWorkspaceProvider } from '@/features/projects/index';
import { ReviewShell } from '@/app/review-shell';

export function PairedShell({ children }: { children: ReactNode }) {
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  return (
    <ReviewShell>
      <ProjectWorkspaceProvider
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
      >
        {children}
      </ProjectWorkspaceProvider>
    </ReviewShell>
  );
}
