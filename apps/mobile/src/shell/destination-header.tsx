import type { ReactNode } from 'react';
import { LeadingToolbar } from '../components/ui/leading-toolbar';
import { useAppSidebar } from '../features/preferences';

export function DestinationHeader({
  children,
  leading,
}: {
  children: ReactNode;
  leading: boolean;
}) {
  const { sidebar } = useAppSidebar();
  return (
    <>
      {leading ? <LeadingToolbar sidebar={sidebar} /> : null}
      {children}
    </>
  );
}
