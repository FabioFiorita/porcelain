import type { ReactNode } from 'react';

export type SheetSize = 'half' | 'tall';

export const sheetDetents = {
  half: [0.5, 1],
  tall: [0.75, 1],
} satisfies Record<SheetSize, number[]>;

export type SheetProps = {
  title: string;
  layout?: 'scroll' | 'fixed';
  children: ReactNode;
};
