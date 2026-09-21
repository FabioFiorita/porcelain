import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { DocumentTabs } from './document-tabs';

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
    const screen = await render(
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
    (await control.element()).focus();
    await userEvent.keyboard('{Enter}');

    expect(actions[example.action]).toHaveBeenCalledWith('file:a.ts');
    expect(actions.onActivate).not.toHaveBeenCalled();
  });
});

describe('document tab presentation', () => {
  it('uses the prototype icons and label for layers and reports', async () => {
    const layerId = 'bf4f1c6b-2b54-423b-a9b5-7c40112b3101';
    const actions = {
      onActivate: vi.fn(),
      onClose: vi.fn(),
      onCloseOthers: vi.fn(),
      onCloseUnpinned: vi.fn(),
      onTogglePin: vi.fn(),
      onOpenToSide: vi.fn(),
    };

    const screen = await render(
      <DocumentTabs
        tabs={['handoff', `layer:${layerId}`]}
        pinned={[]}
        active={'handoff'}
        layers={[{ id: layerId, title: 'Review layer' }]}
        side={null}
        focused
        {...actions}
      />,
    );

    await expect
      .element(screen.getByRole('tab', { name: /Review Close Review/ }))
      .toBeVisible();
    await expect
      .element(screen.getByRole('tab', { name: /1\. Review layer/ }))
      .toBeVisible();
    expect(screen.container.querySelector('svg.lucide-layers')).toBeTruthy();
    expect(
      screen.container.querySelector('svg.lucide-square-stack'),
    ).toBeTruthy();
  });
});
