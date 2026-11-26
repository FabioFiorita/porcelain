import { Option, Schema } from 'effect';
import { expect, it } from 'vite-plus/test';
import {
  commentTargetSchema,
  editCommentParams,
  newCommentParams,
} from './comment-target';

const decode = Schema.decodeUnknownOption(commentTargetSchema);

it.each([
  { kind: 'step' as const, title: 'Keep retries local' },
  { kind: 'node' as const, title: 'Keep retries local', node: 'findNotes' },
  { kind: 'file' as const, path: 'src/search.ts' },
  {
    kind: 'lines' as const,
    path: 'src/search.ts',
    side: 'additions' as const,
    start: 2,
    end: 4,
    text: 'return notes;',
  },
])('opens a new comment on a $kind anchor from its link', (anchor) => {
  expect(decode(newCommentParams('workspace', anchor))).toEqual(
    Option.some({ workspace: 'workspace', anchor }),
  );
});

it('opens an existing draft by its id', () => {
  expect(decode(editCommentParams('workspace', 'draft-1'))).toEqual(
    Option.some({ workspace: 'workspace', commentId: 'draft-1' }),
  );
});

it('refuses a link without a workspace, a malformed anchor or a line range without its text', () => {
  expect(Option.isNone(decode({ anchor: '{"kind":"file","path":"a"}' }))).toBe(
    true,
  );
  expect(Option.isNone(decode({ workspace: 'w', anchor: 'not json' }))).toBe(
    true,
  );
  expect(
    Option.isNone(
      decode({
        workspace: 'w',
        anchor: JSON.stringify({
          kind: 'lines',
          path: 'a.ts',
          side: 'additions',
          start: 1,
          end: 2,
        }),
      }),
    ),
  ).toBe(true);
});
