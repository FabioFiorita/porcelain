import { page, userEvent } from 'vitest/browser';
import { expect, test } from './fixtures.tsx';

test('each accepted keystroke is rendered before its input event completes when highlighting is deferred', async ({
  pierreEditor,
}) => {
  await pierreEditor.ready();
  const editor = page.getByRole('textbox', { name: 'input.txt', exact: true });
  await editor.click();
  pierreEditor.exhaustHighlightBudget();

  await userEvent.keyboard('ab');

  await expect.poll(() => pierreEditor.inputs()).toEqual(['a', 'ab']);
  await expect.element(editor).toHaveTextContent('ab');
});
