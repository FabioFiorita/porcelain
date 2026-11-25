import type { PageActivity } from '@porcelain/client/projects';

export const pageActivity: PageActivity = {
  isActive: () => document.visibilityState !== 'hidden',
  subscribe: (changed) => {
    document.addEventListener('visibilitychange', changed);
    return () => document.removeEventListener('visibilitychange', changed);
  },
};
