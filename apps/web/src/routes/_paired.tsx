import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router';
import { restoreSession, useLocalConnection } from '@/features/access/index';
import { PairedShell } from '@/app/paired-shell';
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
  const connection = useLocalConnection();
  const empty = useRouterState({
    select: (state) => state.location.pathname === '/',
  });
  return connection ? (
    <PairedShell>
      <Outlet />
      <DesktopActions connection={connection} empty={empty} />
    </PairedShell>
  ) : (
    <Navigate to="/pair" replace />
  );
}
