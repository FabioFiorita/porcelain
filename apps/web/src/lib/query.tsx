import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { client, shellClient, shellTrpc, trpc } from './trpc'

export function ApiProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  )

  // Both routers share the one QueryClient — their procedure names are disjoint,
  // so their query keys can't collide and invalidation stays per-router.
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <shellTrpc.Provider client={shellClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </shellTrpc.Provider>
    </trpc.Provider>
  )
}
