import { TanStackDevtools } from '@tanstack/react-devtools';
import { hotkeysDevtoolsPlugin } from '@tanstack/react-hotkeys-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

import { lazy, Suspense } from 'react';

import { PlaygroundPanel } from './playground-panel';

const MockTools =
  import.meta.env.VITE_API_MODE === 'mock'
    ? lazy(() =>
        import('./mock-tools').then((module) => ({
          default: module.MockTools,
        })),
      )
    : null;

export function Devtools() {
  return (
    <TanStackDevtools
      plugins={[
        ...(MockTools
          ? [
              {
                name: 'Mock environment',
                render: (
                  <Suspense fallback={null}>
                    <MockTools />
                  </Suspense>
                ),
              },
            ]
          : []),
        ...(import.meta.env.PORCELAIN_PLAYGROUND_BRIDGE
          ? [
              {
                name: 'Playground',
                render: <PlaygroundPanel />,
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
