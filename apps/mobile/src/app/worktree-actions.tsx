import { useLocalSearchParams, useRouter } from 'expo-router';
import { WorktreeActionsSheet, worktreeActionKind } from '../features/projects';

export default function WorktreeActionsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    environmentId?: string;
    worktreeId?: string;
    kind?: string;
  }>();
  return (
    <WorktreeActionsSheet
      environmentId={params.environmentId}
      worktreeId={params.worktreeId}
      kind={worktreeActionKind(params.kind)}
      onClose={() => router.back()}
      onAction={(kind) => router.setParams({ kind })}
    />
  );
}
