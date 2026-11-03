import { useRouter } from 'expo-router';
import {
  changeAnchor,
  type ReviewResponse,
  type WalkthroughKey,
} from '@porcelain/client/reviews/rules';
import type { Workspace } from '../../projects';
import { commentReviewParams, reviewParams } from '../rules/navigation';

export function useWalkthroughRoutes(workspace: Workspace) {
  const router = useRouter();
  const scope = { workspace: workspace.key };
  return {
    openStop: (stop: Exclude<WalkthroughKey, 'briefing'>) =>
      router.push({ pathname: '/decision', params: { ...scope, stop } }),
    showStop: (stop: Exclude<WalkthroughKey, 'briefing'>) =>
      router.dismissTo({ pathname: '/decision', params: { ...scope, stop } }),
    openStep: (stop: WalkthroughKey, step: string) =>
      router.push({
        pathname: '/decision-step',
        params: { ...scope, stop, step },
      }),
    openSummary: () =>
      router.push({ pathname: '/review-summary', params: scope }),
    openChangedFile: (path: string) =>
      router.push({
        pathname: '/review-file',
        params: { ...reviewParams(workspace.key, { kind: 'worktree' }), path },
      }),
    openInFiles: (path: string) =>
      router.push({ pathname: '/file', params: { ...scope, path } }),
    openFileHistory: (path: string) =>
      router.push({ pathname: '/timeline', params: { ...scope, path } }),
    openThread: (thread: string) =>
      router.navigate({
        pathname: '/review-comments',
        params: {
          ...reviewParams(workspace.key, { kind: 'worktree' }),
          thread,
          origin: 'decision',
        },
      }),
    compose: (review: ReviewResponse, body: string) =>
      router.navigate({
        pathname: '/review-comments',
        params: {
          ...reviewParams(workspace.key, { kind: 'worktree' }),
          anchor: JSON.stringify(changeAnchor(undefined)),
          compose: 'true',
          body,
          feedbackWritable: 'true',
          ...commentReviewParams(review),
        },
      }),
  };
}

export type WalkthroughRoutes = ReturnType<typeof useWalkthroughRoutes>;
