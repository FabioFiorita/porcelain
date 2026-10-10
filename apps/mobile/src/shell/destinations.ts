import type { IconName } from '../shared/icons/icon';

export const destinations = [
  {
    group: '(files)',
    path: '/files',
    title: 'Files',
    icon: 'files',
    routes: ['/files', '/file', '/file-edit', '/file-action'],
  },
  {
    group: '(review)',
    path: '/review',
    title: 'Review',
    icon: 'review',
    routes: ['/review', '/review-file', '/review-comments'],
  },
  {
    group: '(history)',
    path: '/history',
    title: 'History',
    icon: 'history',
    routes: ['/history'],
  },
  {
    group: '(settings)',
    path: '/settings',
    title: 'Settings',
    icon: 'settings',
    routes: ['/settings', '/appearance', '/component-'],
  },
] as const satisfies readonly {
  group: string;
  path: string;
  title: string;
  icon: IconName;
  routes: readonly string[];
}[];

export function destinationForPath(pathname: string) {
  return (
    destinations.find((destination) =>
      destination.routes.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(`${route}/`) ||
          (route.endsWith('-') && pathname.startsWith(route)),
      ),
    ) ?? destinations[0]
  );
}
