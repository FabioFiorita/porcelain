import { createFileRoute, redirect } from '@tanstack/react-router';
import { desktopShell } from '@/shared/shell';
import { defaultSettingsSection } from '@/app/settings-page';

export const Route = createFileRoute(
  '/_paired/settings/$section/$environmentId',
)({
  beforeLoad: ({ params }) => {
    if (!desktopShell || params.section !== 'remotes')
      redirect({
        to: '/settings/$section',
        params: { section: defaultSettingsSection },
        replace: true,
        throw: true,
      });
  },
});
