const tabRoots = ['walkthrough', 'changes', 'files', 'history'] as const;

export type TabRoot = (typeof tabRoots)[number];

export function tabHref<T extends TabRoot>(root: T) {
  return `/(tabs)/(${root})/${root}` as const;
}

export function tabRootPath(path: string): string {
  const match = /^(?:[a-z.]+:\/\/)?\/?([a-z-]+)(\?.*)?$/.exec(path);
  const root = tabRoots.find((tab) => tab === match?.[1]);
  return root ? `${tabHref(root)}${match?.[2] ?? ''}` : path;
}
