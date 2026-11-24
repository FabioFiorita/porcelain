import { expect, test } from 'vite-plus/test';
import { workspaceGateContent } from './workspace-gate';

const reader = { key: 'computer/project/worktree' };
const base = {
  shown: undefined,
  remembered: reader.key,
  expected: undefined,
  nested: false,
  remote: true,
};

test('the outermost reader of a paired computer owns the connection notice', () => {
  expect(
    workspaceGateContent({
      ...base,
      state: { kind: 'selected', workspace: reader },
    }),
  ).toEqual({ kind: 'reading', workspace: reader, notice: true });
  expect(
    workspaceGateContent({
      ...base,
      nested: true,
      state: { kind: 'selected', workspace: reader },
    }),
  ).toEqual({ kind: 'reading', workspace: reader, notice: false });
});

test('a re-paired computer keeps the open reader while its worktrees reload', () => {
  expect(
    workspaceGateContent({
      ...base,
      shown: reader,
      state: { kind: 'loading' },
    }),
  ).toEqual({ kind: 'reading', workspace: reader, notice: true });
});

test('a first load, another remembered worktree or another route waits for its own content', () => {
  expect(workspaceGateContent({ ...base, state: { kind: 'loading' } })).toEqual(
    { kind: 'status' },
  );
  expect(
    workspaceGateContent({
      ...base,
      shown: reader,
      remembered: 'computer/project/other',
      state: { kind: 'loading' },
    }),
  ).toEqual({ kind: 'status' });
  expect(
    workspaceGateContent({
      ...base,
      expected: 'computer/project/other',
      state: { kind: 'selected', workspace: reader },
    }),
  ).toEqual({ kind: 'status' });
});
