import type { DiffLine } from '@porcelain/client/changes/rules';
export type RenderToken = {
  text: string;
  color?: number;
  fontStyle?: number;
  changed?: boolean;
};
export type RenderLine = DiffLine & { tokens?: readonly RenderToken[] };
