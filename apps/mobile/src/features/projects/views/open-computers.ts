import { useRouter } from 'expo-router';

export function useOpenComputers() {
  const router = useRouter();
  return () => router.push('/computers', { withAnchor: true });
}
