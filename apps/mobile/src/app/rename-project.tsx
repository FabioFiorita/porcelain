import { useLocalSearchParams, useRouter } from 'expo-router';
import { RenameProjectSheet } from '../features/projects';

export default function RenameProjectRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    environmentId?: string;
    projectId?: string;
  }>();
  return (
    <RenameProjectSheet
      environmentId={params.environmentId}
      projectId={params.projectId}
      onClose={() => router.back()}
    />
  );
}
