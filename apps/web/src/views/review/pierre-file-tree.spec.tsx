import type {
  FileTreeDirectoryHandle,
  FileTree as TreeModel,
} from '@pierre/trees';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { PierreFileTree } from './pierre-file-tree';

type MenuRenderer = (
  item: { kind: string; path: string },
  context: { anchorRect: DOMRect; close: () => void },
) => ReactNode;
const state = vi.hoisted(() => ({
  model: null as TreeModel | null,
  menu: null as MenuRenderer | null,
}));
vi.mock('@pierre/trees/react', async (original) => ({
  ...(await original<typeof import('@pierre/trees/react')>()),
  FileTree: ({
    model,
    renderContextMenu,
  }: {
    model: TreeModel;
    renderContextMenu: MenuRenderer;
  }) => {
    state.menu = renderContextMenu;
    state.model = model;
    return null;
  },
}));
const noop = () => {};
const props = {
  links: [],
  gitStatus: [],
  selected: '',
  hidden: new Set<string>(),
  changed: new Set<string>(),
  openable: new Set<string>(),
  worktreePath: '/fixture',
  onStartCreate: noop,
  onCreate: async () => {},
  onMove: async () => {},
  onTrash: noop,
  onExpand: noop,
  onSelect: noop,
  onOpenFile: noop,
  onOpenDiff: noop,
  onSetHidden: noop,
};
function directory(path: string) {
  const item = state.model?.getItem(path);
  if (!item?.isDirectory()) throw new Error(`Missing directory ${path}`);
  return item as FileTreeDirectoryHandle;
}
it('keeps a collapsed root closed when another root gains directory contents', async () => {
  const paths = [
    'alpha/',
    'alpha/nested/',
    'alpha/nested/a.ts',
    'alpha/other.ts',
    'beta/',
  ];
  const view = await render(<PierreFileTree {...props} paths={paths} />);
  directory('alpha/').expand();
  directory('alpha/nested/').expand();
  directory('alpha/').collapse();
  expect(directory('alpha/').isExpanded()).toBe(false);
  directory('beta/').expand();
  await view.rerender(
    <PierreFileTree {...props} paths={[...paths, 'beta/b.ts']} />,
  );
  expect(directory('alpha/').isExpanded()).toBe(false);
  expect(directory('beta/').isExpanded()).toBe(true);
});

it('opens the requested diff independently of the default file selection', async () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  try {
    const onOpenDiff = vi.fn();
    const onSelect = vi.fn();
    await render(
      <PierreFileTree
        {...props}
        paths={['page.html']}
        changed={new Set(['page.html'])}
        openable={new Set(['page.html'])}
        onOpenDiff={onOpenDiff}
        onSelect={onSelect}
      />,
    );
    if (!state.menu) throw new Error('Missing menu');
    const menu = await render(
      state.menu(
        { kind: 'file', path: 'page.html' },
        { anchorRect: new DOMRect(), close: noop },
      ),
    );
    await menu.getByRole('menuitem', { name: 'Open diff' }).click();
    expect(onOpenDiff).toHaveBeenCalledWith('page.html');
    expect(onSelect).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
