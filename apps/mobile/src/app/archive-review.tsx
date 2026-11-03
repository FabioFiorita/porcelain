import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArchiveReviewSheet } from '../features/projects';

export default function ArchiveReviewRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    environmentId?: string;
    reviewId?: string;
    projectId?: string;
    mainWorktreeId?: string;
  }>();
  return (
    <ArchiveReviewSheet
      environmentId={params.environmentId}
      reviewId={params.reviewId}
      projectId={params.projectId}
      mainWorktreeId={params.mainWorktreeId}
      onClose={() => router.back()}
    />
  );
}
