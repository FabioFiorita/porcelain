import type { StatusActivity } from '@porcelain/client/access';
import { desktopShell } from '@/shared/shell';

export const statusActivity: StatusActivity = {
  isActive: () =>
    document.visibilityState !== 'hidden' &&
    (!desktopShell || document.hasFocus()),
  subscribe: (changed) => {
    window.addEventListener('focus', changed);
    if (desktopShell) window.addEventListener('blur', changed);
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    document.addEventListener('visibilitychange', changed);
    return () => {
      window.removeEventListener('focus', changed);
      if (desktopShell) window.removeEventListener('blur', changed);
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', changed);
      document.removeEventListener('visibilitychange', changed);
    };
  },
};
