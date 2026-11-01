import type { ReactNode } from 'react';
import { LeadingToolbar } from '../components/ui/leading-toolbar';
import { useAppSidebar } from '../features/preferences';

export function DestinationHeader({
  children,
  leading,
  back,
}: {
  children: ReactNode;
  leading: boolean;
  back: (() => void) | undefined;
}) {
  const { sidebar } = useAppSidebar();
  return (
    <>
      {leading ? <LeadingToolbar sidebar={sidebar} back={back} /> : null}
      {children}
    </>
  );
}
