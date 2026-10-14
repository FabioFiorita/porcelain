import { createFileRoute } from '@tanstack/react-router';
import { ConnectedWorkspace } from '@/app/connected-workspace';

export const Route = createFileRoute('/_paired/$')({
  component: () => <ConnectedWorkspace notice="not-found" />,
});
