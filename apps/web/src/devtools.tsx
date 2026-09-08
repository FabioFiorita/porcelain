import { TanStackDevtools } from '@tanstack/react-devtools';
import { hotkeysDevtoolsPlugin } from '@tanstack/react-hotkeys-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

export function Devtools() {
  return (
    <TanStackDevtools
      plugins={[
        { name: 'Query', render: <ReactQueryDevtoolsPanel /> },
        { name: 'Router', render: <TanStackRouterDevtoolsPanel /> },
        hotkeysDevtoolsPlugin(),
      ]}
    />
  );
}
