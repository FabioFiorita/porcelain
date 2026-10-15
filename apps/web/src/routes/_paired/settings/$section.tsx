import { createFileRoute, useMatch } from '@tanstack/react-router';
import { SettingsPage, settingsSections } from '@/app/settings-page';
import { ConnectedWorkspace } from '@/app/connected-workspace';

export const Route = createFileRoute('/_paired/settings/$section')({
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
    (detail !== undefined && section !== 'remotes')
  )
    return <ConnectedWorkspace notice="not-found" />;
  return (
    <SettingsPage
      section={section}
      environmentId={detail?.params.environmentId}
    />
  );
}
