import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { client, trpc } from './trpc'

export function ApiProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  )

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
