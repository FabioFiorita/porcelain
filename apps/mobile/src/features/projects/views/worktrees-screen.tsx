import { useRouter } from 'expo-router';
import { useAtomRef, useAtomValue } from '@effect/atom-react';
import { readWorktreeNavigator } from '@porcelain/client/projects';
import {
  navigatorEntrySelected,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import { worktreeRow } from '../rules/worktree-row';
import { WorktreeNavigator } from './worktree-navigator';
import type { WorktreeDetails } from './worktree-screen';
import { useWorkspacePickerModel } from './workspace-picker-model';

export function WorktreesScreen({ mode }: { mode: ListDetailMode }) {
  const router = useRouter();
  return (
    <WorktreeNavigator
      onOpenWorktree={(entry) => {
        if (mode === 'stack')
          router.push({
            pathname: '/worktree',
            params: worktreeDetails(entry),
          });
      }}
    />
  );
}

export function useSelectedWorktree(): WorktreeDetails | undefined {
  const { checkout } = useWorkspacePickerModel();
  const remotes = useAtomRef(remoteConnectionState);
  const { projects } = useAtomValue(
    readWorktreeNavigator(remotes.map((entry) => entry.connection)),
  );
  const entry = projects
    .flatMap((project) => project.entries)
    .find((candidate) => navigatorEntrySelected(candidate, checkout));
  return entry ? worktreeDetails(entry) : undefined;
}

function worktreeDetails(entry: NavigatorEntry): WorktreeDetails {
  const row = worktreeRow(entry);
  return {
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
}
