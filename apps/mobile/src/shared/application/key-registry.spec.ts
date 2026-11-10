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

test('a remounted owner takes over its shortcut without a conflict', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  const leave = registry.mount(
    keyRegistration({ owner: 'old', commands: [{ binding: 'changes', run }] }),
  );
  leave();
  flush();
  registry.mount(
    keyRegistration({ owner: 'new', commands: [{ binding: 'changes', run }] }),
  );
  const { commands, conflicts } = activeKeyCommands(
    registry.get(keyRegistrations),
  );
  expect(conflicts).toEqual([]);
  expect(commands.map((command) => command.binding)).toEqual(['changes']);
  expect([...registry.get(keyRegistrations).keys()]).toEqual(['new']);
});

test('an owner that stops declaring commands leaves the live set', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  const leave = registry.mount(
    keyRegistration({ owner: 'list', commands: [{ binding: 'next', run }] }),
  );
  registry.mount(keyRegistration({ owner: 'list', commands: [] }));
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
