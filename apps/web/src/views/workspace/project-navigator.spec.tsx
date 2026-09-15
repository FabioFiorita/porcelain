import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render } from 'vitest-browser-react';
import { SidebarProvider } from '../../components/ui/sidebar';
import { TooltipProvider } from '../../components/ui/tooltip';
import type { Project } from '../../domain/inventory';
import { ProjectNavigator } from './project-navigator';

const projects: Project[] = [
  {
    id: 'project-porcelain',
    name: 'Porcelain',
    available: true,
    worktrees: [
      {
        id: 'worktree-main',
        path: '/home/dev/code/porcelain',
        branch: 'refs/heads/main',
        main: true,
        available: true,
      },
      {
        id: 'worktree-review',
        path: '/home/dev/code/porcelain-review',
        branch: 'refs/heads/agent/review',
        main: false,
        available: true,
      },
      {
        id: 'worktree-archived',
        path: '/home/dev/code/porcelain-archived',
        branch: 'refs/heads/archive/prototype',
        main: false,
        available: false,
      },
    ],
  },
];

async function renderNavigator(selected: string | null = null) {
  const onSelect = vi.fn();
  const screen = await render(
    <TooltipProvider>
      <SidebarProvider>
        <ProjectNavigator
          inventory={{ environmentId: 'environment', projects }}
          selectedWorktreeId={selected ?? undefined}
          onOpenProject={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenShortcuts={vi.fn()}
          onSelect={onSelect}
        />
      </SidebarProvider>
    </TooltipProvider>,
  );
  return { onSelect, screen };
}

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.clearAllMocks();
});
afterAll(() => vi.unstubAllGlobals());

describe('ProjectNavigator', () => {
  it('uses the compact prototype brand treatment', async () => {
    const { screen } = await renderNavigator();

    const logo = screen.getByAltText('');
    await expect.element(logo).toBeVisible();
    expect((await logo.element()).tagName).toBe('IMG');
    expect((await logo.element()).getAttribute('src')).toContain('logo');
    expect((await logo.element()).className).toContain('size-6');
    expect(
      (await screen.getByRole('navigation').element()).querySelector(
        'header > span',
      )?.textContent,
    ).toBe('Porcelain');
  });

  it('shows compact project context and branch rows', async () => {
    const { screen } = await renderNavigator('worktree-review');

    expect(
      (await screen.getByRole('navigation').element()).className,
    ).toContain('text-[13px]');
    expect(
      (await screen.getByRole('heading', { name: 'Porcelain' }).element())
        .className,
    ).toContain('text-[12.5px]');
    await expect
      .element(screen.getByTitle('/home/dev/code/porcelain'))
      .toBeVisible();
    expect(
      (
        await screen.getByRole('button', { name: /agent\/review/ }).element()
      ).getAttribute('aria-current'),
    ).toBe('page');
    await expect.element(screen.getByText('main')).toBeVisible();
  });

  it('keeps unavailable worktrees selectable for archived review data', async () => {
    const { onSelect, screen } = await renderNavigator();
    const archived = screen.getByRole('button', {
      name: /archive\/prototype.*Unavailable/,
    });
    expect((await archived.element()).hasAttribute('disabled')).toBe(false);
    await archived.click();

    expect(onSelect).toHaveBeenCalledWith('worktree-archived');
  });
});
