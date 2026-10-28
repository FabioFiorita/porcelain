const control =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';

export const primaryPill = `${control} rounded-full bg-primary font-medium text-primary-foreground hover:bg-primary/80`;

export const outlinePill = `${control} rounded-full border border-border bg-background font-medium hover:bg-muted`;

export const quietButton = `${control} rounded-md font-medium hover:bg-accent`;

export const smallButton = `${control} h-7 gap-1.5 rounded-lg px-2.5 text-xs leading-4 font-medium`;

export const marginAction = `${quietButton} -ml-1.5 h-7 gap-1.75 pr-2 pl-1.5 text-xs leading-4 [&_svg]:size-3.5`;

export const headerButton = `${quietButton} h-6.5 gap-1.5 px-2 font-sans text-xs leading-4 [&_svg]:size-3.5`;

const tag =
  'inline-flex h-4.5 shrink-0 items-center rounded-sm border px-1.5 text-2xs font-medium whitespace-nowrap';

export const changeTags = {
  new: `${tag} border-transparent bg-foreground leading-4.5 text-background`,
  changed: `${tag} border-border-strong leading-4 text-foreground`,
  removed: `${tag} border-del-strong bg-del-bg leading-4.5 text-del-fg`,
} as const;

export const chip =
  'inline-flex h-5.5 shrink-0 items-center gap-1.25 rounded-full border px-2 text-xs leading-5 font-medium whitespace-nowrap [&_svg]:size-3';

export const primaryButton = `${control} h-8 gap-1.75 rounded-md bg-primary px-3 text-ui leading-4 font-medium text-primary-foreground hover:bg-primary/80 [&_svg]:size-3.5`;

export const outlineButton = `${control} h-8 gap-1.75 rounded-md border border-border-strong px-3 text-ui leading-4 font-medium hover:bg-muted [&_svg]:size-3`;
