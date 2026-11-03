import { useRouter } from 'expo-router';
import { worktreeRow } from '../rules/worktree-row';
import { WorktreeNavigator } from './worktree-navigator';

export function WorktreesScreen() {
  const router = useRouter();
  return (
    <WorktreeNavigator
      onOpenWorktree={(entry) => {
        const row = worktreeRow(entry);
        router.push({
          pathname: '/worktree',
          params: {
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
          },
        });
      }}
    />
  );
}
