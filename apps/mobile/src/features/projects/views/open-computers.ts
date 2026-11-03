import { useRouter } from 'expo-router';
import { requestDocumentLeave } from '../store';

export function useOpenComputers() {
  const router = useRouter();
  return () =>
    requestDocumentLeave(() => router.push('/computers', { withAnchor: true }));
}
