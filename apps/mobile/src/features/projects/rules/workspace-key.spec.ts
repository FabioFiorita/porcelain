import { expect, test } from 'vite-plus/test';
import { workspaceKey } from './workspace-key';

const scope = { projectId: 'project', worktreeId: 'worktree' };

test('a new pairing or route to the same computer keeps the open worktree key', () => {
  const paired = {
    environmentId: 'computer',
    address: 'http://10.0.2.2:4738',
    deviceId: 'first-device',
  };
  const repaired = {
    environmentId: 'computer',
    address: 'https://computer.example.ts.net',
    deviceId: 'second-device',
  };
  expect(workspaceKey(repaired, scope)).toBe(workspaceKey(paired, scope));
  expect(workspaceKey(paired, scope)).toBe('["computer","project","worktree"]');
});

test('another computer or worktree gets its own key', () => {
  const key = workspaceKey({ environmentId: 'computer' }, scope);
  expect(workspaceKey({ environmentId: 'other' }, scope)).not.toBe(key);
  expect(
    workspaceKey(
      { environmentId: 'computer' },
      { ...scope, worktreeId: 'other' },
    ),
  ).not.toBe(key);
});
