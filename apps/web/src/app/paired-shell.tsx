import { useState, type ReactNode } from 'react';
import {
  ProjectWorkspaceProvider,
  RemoveProjectDialog,
  RenameProjectDialog,
} from '@/features/projects/index';
import { useLocalConnection } from '@/features/access/index';
import { ReviewShell } from '@/app/review-shell';

export function PairedShell({ children }: { children: ReactNode }) {
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const connection = useLocalConnection();
  return (
    <ReviewShell>
      <ProjectWorkspaceProvider
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
      >
        {children}
        {connection && (
          <>
            <RenameProjectDialog connection={connection} />
            <RemoveProjectDialog connection={connection} />
          </>
        )}
      </ProjectWorkspaceProvider>
    </ReviewShell>
  );
}
