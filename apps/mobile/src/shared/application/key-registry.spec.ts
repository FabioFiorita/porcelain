import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import { activeKeyCommands } from '../rules/key-commands';
import {
  chosenList,
  focusedList,
  keyRegistration,
  keyRegistrations,
  listPresence,
  lists,
} from './key-registry';

const run = () => undefined;
const appIdleTTL = 400;

const sections = (title: string) => [
  { binding: 'changes' as const, title, run },
];

test('a remount in one commit hands its shortcut over before the scheduler runs', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  const leave = registry.mount(
    keyRegistration({ owner: 'worktree-sections', commands: sections('old') }),
  );
  leave();
  registry.mount(
    keyRegistration({ owner: 'worktree-sections', commands: sections('new') }),
  );
  const live = () => activeKeyCommands(registry.get(keyRegistrations));
  expect(live().conflicts).toEqual([]);
  expect(live().commands.map((command) => command.title)).toEqual(['new']);
  flush();
  expect(live().commands.map((command) => command.title)).toEqual(['new']);
});

test('two different owners of one shortcut stay a conflict', () => {
  const { registry } = scheduledRegistry(appIdleTTL);
  registry.mount(keyRegistration({ owner: 'app', commands: sections('app') }));
  registry.mount(
    keyRegistration({ owner: 'worktree-sections', commands: sections('page') }),
  );
  expect(activeKeyCommands(registry.get(keyRegistrations)).conflicts).toEqual([
    { combo: 'command+1', owners: ['app', 'worktree-sections'] },
  ]);
});

test('an owner that stops declaring commands leaves the live set', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  const leave = registry.mount(
    keyRegistration({
      owner: 'list-cursor',
      commands: [{ binding: 'next', run }],
    }),
  );
  registry.mount(keyRegistration({ owner: 'list-cursor', commands: [] }));
  leave();
  flush();
  expect(registry.get(keyRegistrations).size).toBe(0);
});

test('the list that leaves the screen hands the keys to the one still there', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  registry.mount(focusedList);
  registry.mount(listPresence('worktrees'));
  const leaveFiles = registry.mount(listPresence('files'));
  expect(registry.get(focusedList)).toBe('files');
  registry.set(chosenList, 'worktrees');
  expect(registry.get(focusedList)).toBe('worktrees');
  registry.set(chosenList, 'files');
  leaveFiles();
  flush();
  expect(registry.get(lists)).toEqual(['worktrees']);
  expect(registry.get(focusedList)).toBe('worktrees');
});
