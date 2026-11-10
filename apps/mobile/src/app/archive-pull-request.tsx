import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArchivePullRequestSheet } from '../features/projects';

export default function ArchivePullRequestRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    environmentId?: string;
    number?: string;
    projectId?: string;
    mainWorktreeId?: string;
  }>();
  return (
    <ArchivePullRequestSheet
      environmentId={params.environmentId}
      number={params.number === undefined ? undefined : Number(params.number)}
      projectId={params.projectId}
      mainWorktreeId={params.mainWorktreeId}
      onClose={() => router.back()}
    />
  );
}
