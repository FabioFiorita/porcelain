import { useRouter } from 'expo-router';
import { useAtomRef, useAtomSet, useAtomValue } from '@effect/atom-react';
import { readWorktreeNavigator } from '@porcelain/client/projects';
import {
  navigatorEntrySelected,
  type NavigatorEntry,
} from '@porcelain/client/projects/rules';
import { remoteConnectionState } from '../../../shared/application/store';
import type { ListDetailMode } from '../../../shared/rules/list-detail';
import { worktreeRow } from '../rules/worktree-row';
import { openedWorktree } from '../store';
import { WorktreeNavigator } from './worktree-navigator';
import type { WorktreeDetails } from './worktree-screen';
import { useWorkspacePickerModel } from './workspace-picker-model';

export function WorktreesScreen({ mode }: { mode: ListDetailMode }) {
  const router = useRouter();
  const remember = useAtomSet(openedWorktree);
  return (
    <WorktreeNavigator
      onOpenWorktree={(entry) => {
        const details = worktreeDetails(entry);
        if (mode === 'beside') remember(details);
        else router.push({ pathname: '/worktree', params: details });
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
  const remembered = useAtomValue(openedWorktree);
  const entry = projects
    .flatMap((project) => project.entries)
    .find((candidate) => navigatorEntrySelected(candidate, checkout));
  if (entry) return worktreeDetails(entry);
  return remembered &&
    checkout?.environmentId === remembered.environment &&
    checkout.worktreeId === remembered.worktreeId
    ? remembered
    : undefined;
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
