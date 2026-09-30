import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_paired/$projectId/$worktreeId/')({
  component: WorktreeIndex,
});

function WorktreeIndex() {
  return null;
}
