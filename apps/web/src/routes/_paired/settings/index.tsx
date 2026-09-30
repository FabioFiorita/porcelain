import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_paired/settings/')({
  beforeLoad: () =>
    redirect({
      to: '/settings/$section',
      params: { section: 'appearance' },
      replace: true,
      throw: true,
    }),
});
