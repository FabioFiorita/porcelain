import { rememberPairingDestination } from '@/features/access/index';
import {
  createFileRoute,
  Navigate,
  Outlet,
  redirect,
  useMatches,
  useRouterState,
} from '@tanstack/react-router';
import { restoreSession, useLocalConnection } from '@/features/access/index';
import { PairedShell } from '@/app/paired-shell';
import {
  PairedWorkspace,
  pairedView,
  useWorkspaceBehindSettings,
} from '@/app/paired-workspace';
import { WorkspaceError } from '@/app/workspace-error';
import { WorkspacePending } from '@/app/workspace-pending';
import { DesktopActions } from '@/app/desktop-actions';

export const Route = createFileRoute('/_paired')({
  beforeLoad: async ({ context, location }) => {
    if (!(await restoreSession(context.registry))) {
      rememberPairingDestination(location.href);
      redirect({ to: '/pair', replace: true, throw: true });
    }
  },
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: WorkspacePending,
  errorComponent: WorkspaceError,
  component: PairedLayout,
});

function PairedLayout() {
  const connection = useLocalConnection();
  const current = useMatches({
    select: (matches) => pairedView(matches.at(-1)),
  });
  const { workspace, settingsOpen } = useWorkspaceBehindSettings(current);
  const settled = useRouterState({
    select: (state) =>
      state.status === 'idle' && state.location.pathname === workspace.pathname,
  });
  const href = useRouterState({ select: (state) => state.location.href });
  const empty = useRouterState({
    select: (state) => state.location.pathname === '/',
  });
  return connection ? (
    <PairedShell>
      <PairedWorkspace
        view={workspace}
        settled={settled}
        background={settingsOpen}
        resetKey={href}
      />
      <Outlet />
      <DesktopActions
        connection={connection}
        empty={empty}
        settingsOpen={settingsOpen}
      />
    </PairedShell>
  ) : (
    <Navigate to="/pair" replace />
  );
}
