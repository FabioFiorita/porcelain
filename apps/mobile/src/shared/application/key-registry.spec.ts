import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import { nextList } from '../rules/list-cursor';
import { activeKeyCommands, pressKeyCommand } from '../rules/key-commands';
import {
  chosenList,
  focusedList,
  keyLists,
  keyRegistration,
  listAway,
  listOver,
  listPresence,
  liveKeyCommands,
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
  const live = () => activeKeyCommands(registry.get(liveKeyCommands));
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
  expect(activeKeyCommands(registry.get(liveKeyCommands)).conflicts).toEqual([
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
  expect(registry.get(liveKeyCommands).size).toBe(0);
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

test('a list open over the page keeps the keys until it closes', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  registry.mount(focusedList);
  registry.mount(listPresence('files'));
  registry.set(chosenList, 'files');
  const leaveList = registry.mount(listPresence('worktrees'));
  const leaveOver = registry.mount(listOver('worktrees'));
  expect(registry.get(focusedList)).toBe('worktrees');
  expect(registry.get(keyLists)).toEqual(['worktrees']);
  expect(nextList(registry.get(keyLists), 'worktrees')).toBe('worktrees');
  leaveOver();
  leaveList();
  flush();
  expect(registry.get(keyLists)).toEqual(['files']);
  expect(registry.get(focusedList)).toBe('files');
});

test('a list that stops covering the page shares the keys again', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  registry.mount(focusedList);
  registry.mount(listPresence('files'));
  registry.mount(listPresence('worktrees'));
  const leaveOver = registry.mount(listOver('worktrees'));
  expect(registry.get(keyLists)).toEqual(['worktrees']);
  leaveOver();
  flush();
  expect(registry.get(keyLists)).toEqual(['files', 'worktrees']);
  expect(nextList(registry.get(keyLists), 'worktrees')).toBe('files');
});

const tabOwners = (
  registry: ReturnType<typeof scheduledRegistry>['registry'],
) =>
  [...registry.get(liveKeyCommands)]
    .filter(([, commands]) =>
      commands.some((command) => command.binding === 'nextList'),
    )
    .map(([owner]) => owner);

const pressTab = (registry: ReturnType<typeof scheduledRegistry>['registry']) =>
  pressKeyCommand(registry.get(liveKeyCommands), 'nextList');

test('a list slid away leaves the page its keys and keeps Tab', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  registry.mount(focusedList);
  registry.mount(liveKeyCommands);
  registry.mount(listPresence('files'));
  const leaveAway = registry.mount(listAway('worktrees'));
  expect(registry.get(keyLists)).toEqual(['files']);
  expect(tabOwners(registry)).toEqual(['list-tab']);
  pressTab(registry);
  expect(registry.get(focusedList)).toBe('files');
  leaveAway();
  flush();
  expect(tabOwners(registry)).toEqual([]);
});

test('a list slid away over a page without a list still keeps Tab', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  registry.mount(focusedList);
  registry.mount(liveKeyCommands);
  const leaveAway = registry.mount(listAway('worktrees'));
  expect(registry.get(keyLists)).toEqual([]);
  expect(tabOwners(registry)).toEqual(['list-tab']);
  pressTab(registry);
  expect(registry.get(focusedList)).toBeUndefined();
  leaveAway();
  flush();
  expect(tabOwners(registry)).toEqual([]);
});

test('Tab has one owner at every step while a searched list folds away from History', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  const owners: string[][] = [];
  registry.subscribe(liveKeyCommands, () => owners.push(tabOwners(registry)));
  registry.mount(focusedList);
  registry.mount(listPresence('history'));
  const leavePresence = registry.mount(listPresence('worktrees'));
  const leaveCursor = registry.mount(
    keyRegistration({
      owner: 'list-cursor',
      commands: [{ binding: 'next', run }],
    }),
  );
  expect(registry.get(focusedList)).toBe('worktrees');
  expect(tabOwners(registry)).toEqual(['list-tab']);
  leavePresence();
  registry.mount(listAway('worktrees'));
  leaveCursor();
  expect(tabOwners(registry)).toEqual(['list-tab']);
  registry.mount(
    keyRegistration({
      owner: 'list-cursor',
      commands: [{ binding: 'previous', run }],
    }),
  );
  flush();
  expect(registry.get(focusedList)).toBe('history');
  expect(tabOwners(registry)).toEqual(['list-tab']);
  expect(owners.every((step) => step.length <= 1)).toBe(true);
  expect(activeKeyCommands(registry.get(liveKeyCommands)).conflicts).toEqual(
    [],
  );
});
