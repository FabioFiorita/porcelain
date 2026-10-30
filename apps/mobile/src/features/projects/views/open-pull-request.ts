import { useRouter, useSegments } from 'expo-router';
import { isTablet } from '../../../shared/navigation/is-tablet';
import type { PullRequestDocument } from '../../../shared/rules/workspace-documents';
import { useWorkspaceSession } from '../store';
import { useWorkspace } from './workspace';
import { pullRequestRoute } from '../rules/retained-review-route';

export function useOpenPullRequest() {
  const router = useRouter();
  const segments = useSegments();
  const [group] = segments;
  const workspace = useWorkspace();
  const key =
    workspace.state.kind === 'selected' ? workspace.state.workspace.key : '';
  const { open } = useWorkspaceSession(key, 'files');
  return (document: PullRequestDocument) => {
    if (isTablet && key) {
      open(document);
      if (['files', 'review', 'history'].includes(segments.at(-1) ?? ''))
        return;
      router.navigate('/(files)/files');
    } else
      router.push({
        pathname: pullRequestRoute(group),
        params: {
          environment: document.environmentId,
          projectId: document.projectId,
          reviewId: document.reviewId,
          number: String(document.number),
        },
      });
  };
}
