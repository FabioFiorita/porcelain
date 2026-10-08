export type RenderToken = {
  text: string;
  color?: number;
  fontStyle?: number;
  tone?: 'plain' | 'keyword' | 'string' | 'comment' | 'number';
  changed?: boolean;
};
export type RenderLine = {
  id: string;
  text: string;
  oldLine?: number;
  newLine?: number;
  kind?: 'context' | 'added' | 'removed' | 'gap';
  tokens?: readonly RenderToken[];
};
