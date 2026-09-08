import { TanStackDevtools } from '@tanstack/react-devtools';
import { hotkeysDevtoolsPlugin } from '@tanstack/react-hotkeys-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import type { BeginConnection } from './connection-form';
import { PlaygroundPanel } from './playground-panel';

export function Devtools(props: {
  connected: boolean;
  beginConnection: BeginConnection;
}) {
  return (
    <TanStackDevtools
      plugins={[
        ...(import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE
          ? [
              {
                name: 'Playground',
                render: <PlaygroundPanel {...props} />,
              },
            ]
          : []),
        { name: 'Query', render: <ReactQueryDevtoolsPanel /> },
        { name: 'Router', render: <TanStackRouterDevtoolsPanel /> },
        hotkeysDevtoolsPlugin(),
      ]}
    />
  );
}
