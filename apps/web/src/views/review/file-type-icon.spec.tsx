import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { FileTypeIcon, PierreIconSprite } from './file-type-icon';

describe('Pierre file icons', () => {
  it('resolves the same built-in token used by the Files tree', async () => {
    const screen = await render(<FileTypeIcon path="src/app.tsx" />);

    expect(
      screen.container.querySelector('[data-icon-token="react"]'),
    ).toBeTruthy();
  });

  it('mounts the built-in sprite as document-level symbols', async () => {
    await render(<PierreIconSprite />);

    expect(document.querySelector('[data-icon-sprite]')).toBeTruthy();
    expect(document.querySelector('#file-tree-builtin-react')).toBeTruthy();
  });
});
