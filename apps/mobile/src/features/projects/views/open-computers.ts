import { useRouter } from 'expo-router';
import { useSettingsCategory } from '../../access';
import { isTablet } from '../../../shared/navigation/is-tablet';
import { requestDocumentLeave } from '../store';

export function useOpenComputers() {
  const router = useRouter();
  const { select } = useSettingsCategory();
  return () => {
    if (!isTablet) {
      router.push('/computers');
      return;
    }
    select('computers');
    requestDocumentLeave(() => router.replace('/settings'));
  };
}
