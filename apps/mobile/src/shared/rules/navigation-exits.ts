type NavigationLevel = {
  key?: string | undefined;
  type?: string | undefined;
  index?: number | undefined;
  routes?:
    | readonly { name: string; state?: NavigationLevel | undefined }[]
    | undefined;
};

export function navigationExits(root: NavigationLevel | undefined) {
  const routes = root?.routes ?? [];
  const top = routes[root?.index ?? routes.length - 1];
  let back = false;
  for (let level = root; level;) {
    const levelRoutes = level.routes ?? [];
    const index = level.index ?? levelRoutes.length - 1;
    if (level.type === 'stack' && index > 0) back = true;
    level = levelRoutes[index]?.state;
  }
  return { back, close: top !== undefined && top.name !== '(tabs)' };
}
