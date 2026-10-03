import type { CSSProperties } from 'react';

export type CssVariables = CSSProperties & {
  [name: `--${string}`]: string | number | undefined;
};
