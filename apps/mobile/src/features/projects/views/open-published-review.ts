import { useRouter } from 'expo-router';
import { useAtomRef } from '@effect/atom-react';
import { remoteConnectionState } from '../../../shared/application/store';
import { requestDocumentLeave } from '../store';

export function useOpenPublishedReview() {
  const router = useRouter();
  const remotes = useAtomRef(remoteConnectionState);
  return (review: { reviewId: string; environmentId: string }) => {
    const remote = remotes.find(
      (candidate) => candidate.remote.environmentId === review.environmentId,
    );
    if (!remote) return;
    requestDocumentLeave(() =>
      router.push({
        pathname: '/reviews/[reviewId]',
        params: {
          reviewId: review.reviewId,
          environment: review.environmentId,
          host: new URL(remote.remote.address).host,
        },
      }),
    );
  };
}
