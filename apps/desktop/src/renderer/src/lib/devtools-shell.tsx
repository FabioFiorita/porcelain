import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { ChannelsDevtoolsPanel } from './channels-devtools-panel'
import { ProductDevtoolsPanel } from './product-devtools-panel'

/**
 * The unified TanStack Devtools shell — ONE floating launcher that hosts every
 * panel through its `plugins` array, so product code never couples to a single
 * library's inspector. Add built-in TanStack panels (the Query panel below) and
 * product-specific panels (Porcelain's own store inspector) as sibling entries.
 *
 * This module is loaded ONLY behind the `import.meta.env.DEV` gate in
 * {@link Devtools}, so neither it nor the devtools packages (devDependencies)
 * reach the production bundle (`pnpm start` / the packaged app).
 */
export function DevtoolsShell(): React.JSX.Element {
  return (
    <TanStackDevtools
      plugins={[
        // Built-in TanStack panel — the React Query cache/queries inspector.
        // It reads the QueryClient from context, so the shell must mount inside
        // the app's QueryClientProvider (it does — see App.tsx / ApiProvider).
        {
          name: 'TanStack Query',
          render: <ReactQueryDevtoolsPanel />,
        },
        // Product-specific panel — Porcelain's own zustand store inspector.
        {
          name: 'Porcelain',
          render: <ProductDevtoolsPanel />,
        },
        // Product-specific panel — live mirror of the five agent channels.
        {
          name: 'Porcelain Channels',
          render: <ChannelsDevtoolsPanel />,
        },
      ]}
    />
  )
}
