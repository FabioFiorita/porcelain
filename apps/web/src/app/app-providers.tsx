import { HotkeysProvider } from '@tanstack/react-hotkeys';
import { RegistryContext } from '@effect/atom-react';
import type { AtomRegistry } from 'effect/reactivity';
import { StrictMode, type ReactNode } from 'react';
import { NotificationProvider } from '@/shared/views/notify';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspaceProvider } from '@/app/workspace-provider';

export function AppProviders({
  registry,
  children,
}: {
  registry: AtomRegistry.AtomRegistry;
  children: ReactNode;
}) {
  return (
    <StrictMode>
      <RegistryContext.Provider value={registry}>
        <HotkeysProvider
          defaultOptions={{
            hotkey: {
              conflictBehavior: import.meta.env.DEV ? 'error' : 'warn',
            },
          }}
        >
          <TooltipProvider delay={400}>
            <WorkspaceProvider>
              <NotificationProvider>{children}</NotificationProvider>
            </WorkspaceProvider>
          </TooltipProvider>
        </HotkeysProvider>
      </RegistryContext.Provider>
    </StrictMode>
  );
}
