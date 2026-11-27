import { useRouter } from 'expo-router';

export function useOpenComputers() {
  const router = useRouter();
  return () => router.navigate('/computers', { withAnchor: true });
}
