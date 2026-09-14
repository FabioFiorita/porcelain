// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FileTypeIcon, PierreIconSprite } from './file-type-icon';

afterEach(cleanup);

describe('Pierre file icons', () => {
  it('resolves the same built-in token used by the Files tree', () => {
    const { container } = render(<FileTypeIcon path="src/app.tsx" />);

    expect(container.querySelector('[data-icon-token="react"]')).toBeTruthy();
  });

  it('mounts the built-in sprite as document-level symbols', () => {
    render(<PierreIconSprite />);

    expect(document.querySelector('[data-icon-sprite]')).toBeTruthy();
    expect(document.querySelector('#file-tree-builtin-react')).toBeTruthy();
  });
});
