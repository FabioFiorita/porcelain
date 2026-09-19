import { TanStackDevtools } from '@tanstack/react-devtools';
import { hotkeysDevtoolsPlugin } from '@tanstack/react-hotkeys-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import type { AnyRouter } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

/** Same panels as apps/web/src/development/devtools.tsx. Dev builds only. */
export function Devtools({ router }: { router: AnyRouter }) {
  return (
    <TanStackDevtools
      plugins={[
        { name: 'Query', render: <ReactQueryDevtoolsPanel /> },
        {
          name: 'Router',
          render: <TanStackRouterDevtoolsPanel router={router} />,
        },
        hotkeysDevtoolsPlugin(),
      ]}
    />
  );
}
