import type { PatchLine } from '@porcelain/client/changes/rules';
export type RenderToken = {
  text: string;
  color?: number;
  fontStyle?: number;
  changed?: boolean;
};
export type RenderLine = PatchLine & { tokens?: readonly RenderToken[] };
