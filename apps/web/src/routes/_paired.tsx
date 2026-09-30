import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router';
import { useState } from 'react';
import { restoreSession, useAccessStore } from '@/features/access/index';
import { ProjectWorkspaceProvider } from '@/features/projects/index';
import { ReviewShell } from '@/app/review-shell';
import { WorkspaceError } from '@/app/workspace-error';
import { WorkspacePending } from '@/app/workspace-pending';
import { DesktopActions } from '@/app/desktop-actions';

export const Route = createFileRoute('/_paired')({
  beforeLoad: async ({ context }) => {
    if (!(await restoreSession(context.queryClient)))
      redirect({ to: '/pair', replace: true, throw: true });
  },
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
  component: PairedLayout,
});

function PairedLayout() {
  const connected = useAccessStore((state) => state.connection !== null);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const empty = useRouterState({
    select: (state) => state.location.pathname === '/',
  });
  return connected ? (
    <ReviewShell>
      <ProjectWorkspaceProvider
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
      >
        <Outlet />
        <DesktopActions empty={empty} />
      </ProjectWorkspaceProvider>
    </ReviewShell>
  ) : (
    <Navigate to="/pair" replace />
  );
}
