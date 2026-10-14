import type { IconName } from '../shared/icons/icon';

export const destinations = [
  {
    group: '(files)',
    path: '/files',
    title: 'Files',
    icon: 'files',
    sidebarId: 'sidebar-files',
    routes: ['/files', '/file'],
  },
  {
    group: '(review)',
    path: '/review',
    title: 'Review',
    icon: 'review',
    sidebarId: 'sidebar-review',
    routes: ['/review', '/review-file', '/review-comments'],
  },
  {
    group: '(history)',
    path: '/history',
    title: 'History',
    icon: 'history',
    sidebarId: 'sidebar-history',
    routes: ['/history'],
  },
  {
    group: '(settings)',
    path: '/settings',
    title: 'Settings',
    icon: 'settings',
    sidebarId: 'sidebar-settings',
    routes: [
      '/settings',
      '/appearance',
      '/component-library',
      '/component-preview',
      '/component-button',
      '/component-text',
    ],
  },
] as const satisfies readonly {
  group: string;
  path: string;
  title: string;
  icon: IconName;
  sidebarId: string;
  routes: readonly string[];
}[];

export function destinationForPath(pathname: string) {
  return (
    destinations.find((destination) =>
      destination.routes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
    ) ?? destinations[0]
  );
}
