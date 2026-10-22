import { createFileRoute, redirect, useMatch } from '@tanstack/react-router';
import { SettingsPage, settingsSections } from '@/app/settings-page';
import { ConnectedWorkspace } from '@/app/connected-workspace';

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
  if (
    !settingsSections.some((item) => item.id === section) ||
    (detail !== undefined && section !== 'computers')
  )
    return <ConnectedWorkspace notice="not-found" />;
  return (
    <SettingsPage
      section={section}
      environmentId={detail?.params.environmentId}
    />
  );
}
