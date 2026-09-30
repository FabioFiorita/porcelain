import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/app/settings-dialog';

export const Route = createFileRoute(
  '/_paired/$projectId/$worktreeId/settings',
)({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { projectId, worktreeId } = Route.useParams();
  return <SettingsPage projectId={projectId} worktreeId={worktreeId} />;
}
