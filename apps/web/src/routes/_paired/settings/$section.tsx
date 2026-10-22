import { createFileRoute, redirect, useMatch } from '@tanstack/react-router';
import { SettingsPage, settingsSections } from '@/app/settings-page';
import { ConnectedWorkspace } from '@/app/connected-workspace';
import { useConnectedContext } from '@/features/access/index';
import { useInventory } from '@/features/projects/index';
import { useDocumentTitle } from '@/shared/hooks/use-document-title';

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
  const valid =
    settingsSections.some((item) => item.id === section) &&
    (detail === undefined || section === 'computers');
  const { connection } = useConnectedContext();
  const { environment } = useInventory(connection);
  useDocumentTitle(
    valid
      ? environment.custom
        ? `Settings · ${environment.name}`
        : 'Settings'
      : 'Porcelain',
  );
  if (!valid) return <ConnectedWorkspace notice="not-found" />;
  return (
    <ConnectedWorkspace>
      <SettingsPage
        section={section}
        environmentId={detail?.params.environmentId}
      />
    </ConnectedWorkspace>
  );
}
