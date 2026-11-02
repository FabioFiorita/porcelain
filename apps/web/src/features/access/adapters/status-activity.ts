import type { StatusActivity } from '@porcelain/client/access';
import { desktopShell } from '@/shared/shell';
import { onDesktopPowerState } from '@/shared/adapters/desktop';

export const statusActivity: StatusActivity = {
  isActive: () =>
    document.visibilityState !== 'hidden' &&
    (!desktopShell || document.hasFocus()),
  subscribe: (changed) => {
    const unsubscribePower = onDesktopPowerState(changed);
    const activityChanged = () => changed();
    window.addEventListener('focus', activityChanged);
    if (desktopShell) window.addEventListener('blur', activityChanged);
    window.addEventListener('online', activityChanged);
    window.addEventListener('offline', activityChanged);
    document.addEventListener('visibilitychange', activityChanged);
    return () => {
      unsubscribePower();
      window.removeEventListener('focus', activityChanged);
      if (desktopShell) window.removeEventListener('blur', activityChanged);
      window.removeEventListener('online', activityChanged);
      window.removeEventListener('offline', activityChanged);
      document.removeEventListener('visibilitychange', activityChanged);
    };
  },
};
