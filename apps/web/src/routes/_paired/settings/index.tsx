import { createFileRoute, redirect } from '@tanstack/react-router';
import { defaultSettingsSection } from '@/app/settings-page';

export const Route = createFileRoute('/_paired/settings/')({
  beforeLoad: () => {
    redirect({
      to: '/settings/$section',
      params: { section: defaultSettingsSection },
      replace: true,
      throw: true,
    });
  },
});
