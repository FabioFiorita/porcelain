import { useAtomSet } from '@effect/atom-react';
import { useRouter } from 'expo-router';
import type { ReviewComparison } from '../../../shared/rules/review-comparison';
import { reviewFileDocumentKey, reviewParams } from '../rules/navigation';
import { chooseReviewFileScope } from '../store';

export function useOpenReviewFile(workspaceKey: string) {
  const router = useRouter();
  const chooseScope = useAtomSet(chooseReviewFileScope);
  return (input: {
    path: string;
    comparison: ReviewComparison;
    scope?: string | undefined;
  }) => {
    if (input.scope)
      chooseScope({
        owner: JSON.stringify([
          workspaceKey,
          reviewFileDocumentKey(input.path, input.comparison),
        ]),
        scope: input.scope,
      });
    router.push({
      pathname: '/review-file',
      params: {
        ...reviewParams(workspaceKey, input.comparison),
        path: input.path,
      },
    });
  };
}
