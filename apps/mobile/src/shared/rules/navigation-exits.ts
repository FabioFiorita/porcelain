type NavigationLevel = {
  key?: string | undefined;
  type?: string | undefined;
  index?: number | undefined;
  routes: readonly { name: string; state?: NavigationLevel | undefined }[];
};

export function navigationExits(root: NavigationLevel | undefined) {
  const top = root?.routes[root.index ?? root.routes.length - 1];
  let back = false;
  for (let level = root; level; ) {
    const index = level.index ?? level.routes.length - 1;
    if (level.type !== 'tab' && index > 0) back = true;
    level = level.routes[index]?.state;
  }
  return { back, close: top !== undefined && top.name !== '(tabs)' };
}
