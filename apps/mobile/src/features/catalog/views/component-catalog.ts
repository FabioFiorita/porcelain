export const primitiveNames = [
  'IconButton',
  'Input',
  'Badge',
  'Item',
  'States',
  'Files',
  'FileTree',
  'Review',
  'History',
  'CodeView',
  'DiffView',
  'MarkdownView',
  'ImageView',
  'HtmlPreview',
] as const;

export const componentNames = ['Text', 'Button', ...primitiveNames] as const;

export type ComponentName = (typeof componentNames)[number];
