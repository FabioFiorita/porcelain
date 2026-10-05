import { RegistryProvider } from '@effect/atom-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const client = new QueryClient();

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <RegistryProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </RegistryProvider>
  );
}
