import { useRouter } from 'expo-router';
import { useAtomSet, useAtomValue } from '@effect/atom-react';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import { worktreeRow } from '../rules/worktree-row';
import { selectedWorktree, type WorktreeDetails } from '../store';
import { WorktreeNavigator } from './worktree-navigator';
import { useWorkspacePickerModel } from './workspace-picker-model';

export function WorktreesScreen({ mode }: { mode: ListDetailMode }) {
  const router = useRouter();
  const select = useAtomSet(selectedWorktree);
  return (
    <WorktreeNavigator
      onOpenWorktree={(entry) => {
        const row = worktreeRow(entry);
        const details: WorktreeDetails = {
          title: row.title,
          project: entry.projectName,
          computer: entry.environmentName,
          environment: entry.environmentId,
          projectId: entry.projectId,
          worktreeId: entry.worktreeId ?? '',
          review: row.review,
          ...(entry.review.state === 'available'
            ? {
                reviewId: entry.review.reviewId,
                ...(entry.review.pullRequestNumber === undefined
                  ? {}
                  : { number: String(entry.review.pullRequestNumber) }),
              }
            : {}),
        };
        if (mode === 'beside') select(details);
        else router.push({ pathname: '/worktree', params: details });
      }}
    />
  );
}

export function useSelectedWorktree() {
  const details = useAtomValue(selectedWorktree);
  const { checkout } = useWorkspacePickerModel();
  return details &&
    checkout?.environmentId === details.environment &&
    checkout.worktreeId === details.worktreeId
    ? details
    : undefined;
}
