import type { ReactNode } from 'react';
import '../pierre.css';
import { PierreIconSprite } from '@/features/files/index';
import { PierreWorkers } from '@/features/reviews/index';

export function ReviewShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PierreIconSprite />
      <PierreWorkers>{children}</PierreWorkers>
    </>
  );
}
