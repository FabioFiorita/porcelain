import type { ReactNode } from 'react';
import '../../../pierre.css';
import { PierreIconSprite } from './file-type-icon';
import { PierreWorkers } from './pierre-workers';

export function ReviewShell({ children }: { children: ReactNode }) {
  return (
    <>
      <PierreIconSprite />
      <PierreWorkers>{children}</PierreWorkers>
    </>
  );
}
