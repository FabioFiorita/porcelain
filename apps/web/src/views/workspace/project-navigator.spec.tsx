// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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

function renderNavigator(selected: string | null = null) {
  const onSelect = vi.fn();
  render(
    <TooltipProvider>
      <SidebarProvider>
        <ProjectNavigator
          projects={projects}
          selected={selected}
          onSelect={onSelect}
        />
      </SidebarProvider>
    </TooltipProvider>,
  );
  return onSelect;
}

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => cleanup());
afterAll(() => vi.unstubAllGlobals());

describe('ProjectNavigator', () => {
  it('shows compact project context and branch rows', () => {
    renderNavigator('worktree-review');

    expect(screen.getByRole('navigation').className).toContain('text-[13px]');
    expect(
      screen.getByRole('heading', { name: 'Porcelain' }).className,
    ).toContain('text-[12.5px]');
    expect(screen.getByTitle('/home/dev/code/porcelain')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: /agent\/review/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByText('main')).toBeTruthy();
  });

  it('keeps unavailable worktrees selectable for archived review data', async () => {
    const onSelect = renderNavigator();
    const archived = screen.getByRole('button', {
      name: /archive\/prototype.*Unavailable/,
    });
    expect(archived.hasAttribute('disabled')).toBe(false);
    fireEvent.click(archived);

    expect(onSelect).toHaveBeenCalledWith('worktree-archived');
  });
});
