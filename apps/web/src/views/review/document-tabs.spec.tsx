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
