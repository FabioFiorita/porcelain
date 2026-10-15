import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage, settingsSections } from '@/app/settings-page';
import { ConnectedWorkspace } from '@/app/connected-workspace';

export const Route = createFileRoute('/_paired/settings/$section')({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { section } = Route.useParams();
  if (!settingsSections.some((item) => item.id === section))
    return <ConnectedWorkspace notice="not-found" />;
  return <SettingsPage section={section} />;
}
