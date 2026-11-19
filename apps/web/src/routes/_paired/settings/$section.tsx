import { createFileRoute, redirect, useMatch } from '@tanstack/react-router';
import { SettingsDialog, settingsTarget } from '@/app/settings-page';

export const Route = createFileRoute('/_paired/settings/$section')({
  beforeLoad: ({ params }) => {
    if (params.section === 'devices' || params.section === 'integrations')
      redirect({
        to: '/settings/$section/$environmentId',
        params: { section: 'computers', environmentId: 'this-computer' },
        replace: true,
        throw: true,
      });
  },
  component: SettingsRoute,
});

function SettingsRoute() {
  const { section } = Route.useParams();
  const detail = useMatch({
    from: '/_paired/settings/$section/$environmentId',
    shouldThrow: false,
  });
  const target = settingsTarget(section, detail?.params.environmentId);
  return target ? <SettingsDialog {...target} /> : null;
}
