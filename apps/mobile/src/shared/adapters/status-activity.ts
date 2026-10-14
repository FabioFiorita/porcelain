import { AppState } from 'react-native';
import type { StatusActivity } from '@porcelain/client/access';

export const statusActivity: StatusActivity = {
  isActive: () => AppState.currentState === 'active',
  subscribe: (changed) => {
    const subscription = AppState.addEventListener('change', changed);
    return () => subscription.remove();
  },
};
