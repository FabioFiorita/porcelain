type NavigationLevel = {
  key?: string | undefined;
  type?: string | undefined;
  index?: number | undefined;
  routes?:
    | readonly { name: string; state?: NavigationLevel | undefined }[]
    | undefined;
};

const NESTED_SHEETS = new Set(['pair-computer', 'scan-pairing-link']);

export function navigationExits(root: NavigationLevel | undefined): {
  back: boolean;
  close: string | undefined;
} {
  let back = false;
  let close: string | undefined;
  for (let level = root; level;) {
    const routes = level.routes ?? [];
    const index = level.index ?? routes.length - 1;
    const current = routes[index];
    if (level.type === 'stack' && index > 0) back = true;
    const presented =
      routes.some((route) => route.name === '(tabs)') &&
      current?.name !== '(tabs)';
    if (presented || NESTED_SHEETS.has(current?.name ?? '')) close = level.key;
    level = current?.state;
  }
  return { back, close };
}
