import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { InlineComposer } from './inline-composer';

const mutation = vi.hoisted(() => ({
  submit: vi.fn().mockRejectedValue(new Error('response lost')),
}));

vi.mock('../../query/comments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../query/comments')>()),
  useCreateComment: () => ({
    submit: mutation.submit,
    isPending: false,
    error: null,
  }),
}));

afterEach(() => mutation.submit.mockClear());

describe('InlineComposer', () => {
  it('reuses pending ids when the owner retries an unchanged comment', async () => {
    const screen = await render(
      <InlineComposer
        scope={{ projectId: 'project', worktreeId: 'worktree' }}
        anchor={{ kind: 'file', filePath: 'README.md' }}
        onClose={vi.fn()}
      />,
    );

    await screen.getByRole('textbox', { name: 'Comment' }).fill('Try again');
    await screen.getByRole('button', { name: 'Comment' }).click();
    await expect.poll(() => mutation.submit.mock.calls.length).toBe(1);
    await screen.getByRole('button', { name: 'Comment' }).click();
    await expect.poll(() => mutation.submit.mock.calls.length).toBe(2);

    expect(mutation.submit.mock.calls[1]?.[0]).toEqual(
      mutation.submit.mock.calls[0]?.[0],
    );
  });
});
