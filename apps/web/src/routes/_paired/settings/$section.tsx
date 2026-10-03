import { createFileRoute, redirect } from '@tanstack/react-router';
import { SettingsPage, settingsSections } from '@/app/settings-page';

export const Route = createFileRoute('/_paired/settings/$section')({
  beforeLoad: ({ params }) => {
    if (!settingsSections.some((item) => item.id === params.section))
      redirect({
        to: '/settings/$section',
        params: { section: 'appearance' },
        replace: true,
        throw: true,
      });
  },
  component: SettingsRoute,
});

function SettingsRoute() {
  const { section } = Route.useParams();
  return <SettingsPage section={section} />;
}
