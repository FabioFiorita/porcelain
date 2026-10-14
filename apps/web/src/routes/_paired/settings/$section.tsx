import { createFileRoute, redirect, useMatch } from '@tanstack/react-router';
import {
  defaultSettingsSection,
  SettingsPage,
  settingsSections,
} from '@/app/settings-page';

export const Route = createFileRoute('/_paired/settings/$section')({
  beforeLoad: ({ params }) => {
    if (!settingsSections.some((item) => item.id === params.section))
      redirect({
        to: '/settings/$section',
        params: { section: defaultSettingsSection },
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
  return (
    <SettingsPage
      section={section}
      environmentId={detail?.params.environmentId}
    />
  );
}
