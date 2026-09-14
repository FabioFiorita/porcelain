// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentTabs } from './document-tabs';

afterEach(cleanup);

describe('document tab keyboard controls', () => {
  it.each([
    { pinned: false, label: 'Close a.ts', action: 'onClose' as const },
    { pinned: true, label: 'Unpin a.ts', action: 'onTogglePin' as const },
  ])('lets $label handle Enter without activating its tab', async (example) => {
    const actions = {
      onActivate: vi.fn(),
      onClose: vi.fn(),
      onCloseOthers: vi.fn(),
      onCloseUnpinned: vi.fn(),
      onTogglePin: vi.fn(),
      onOpenToSide: vi.fn(),
    };
    render(
      <DocumentTabs
        tabs={['file:a.ts']}
        pinned={example.pinned ? ['file:a.ts'] : []}
        active="file:a.ts"
        layers={[]}
        side={null}
        focused
        {...actions}
      />,
    );

    const control = screen.getByRole('button', { name: example.label });
    control.focus();
    await userEvent.setup().keyboard('{Enter}');

    expect(actions[example.action]).toHaveBeenCalledWith('file:a.ts');
    expect(actions.onActivate).not.toHaveBeenCalled();
  });
});

describe('document tab presentation', () => {
  it('uses the prototype icons and label for layers and reports', () => {
    const reportId = 'afa08127-5c27-46bf-9d06-e8401f2aa102';
    const layerId = 'bf4f1c6b-2b54-423b-a9b5-7c40112b3101';
    const actions = {
      onActivate: vi.fn(),
      onClose: vi.fn(),
      onCloseOthers: vi.fn(),
      onCloseUnpinned: vi.fn(),
      onTogglePin: vi.fn(),
      onOpenToSide: vi.fn(),
    };

    const { container } = render(
      <DocumentTabs
        tabs={[`artifact:${reportId}`, `layer:${layerId}`]}
        pinned={[]}
        active={`artifact:${reportId}`}
        layers={[{ id: layerId, title: 'Review layer', files: [] }]}
        artifacts={[
          {
            id: reportId,
            worktreeId: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
            name: 'handoff.html',
            sizeBytes: 120,
            createdAt: '2026-09-12T15:20:00Z',
          },
        ]}
        side={null}
        focused
        {...actions}
      />,
    );

    expect(screen.getByRole('tab', { name: /Report/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /1\. Review layer/ })).toBeTruthy();
    expect(container.querySelector('svg.lucide-newspaper')).toBeTruthy();
    expect(container.querySelector('svg.lucide-square-stack')).toBeTruthy();
  });
});
