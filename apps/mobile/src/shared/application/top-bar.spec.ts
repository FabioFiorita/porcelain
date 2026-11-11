import { expect, test } from 'vitest';
import { scheduledRegistry } from '../../../spec/kit/atom-registry';
import {
  publishedTopBarActions,
  topBarPublication,
  topBarPublications,
} from './top-bar';

const onPress = () => undefined;
const button = (label: string) =>
  [{ kind: 'button', id: label, label, icon: 'more', onPress }] as const;
const appIdleTTL = 400;

test('a remount in one commit hands its top-bar actions over before the scheduler runs', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  const leave = registry.mount(
    topBarPublication({ owner: 'git-actions', actions: button('old') }),
  );
  leave();
  registry.mount(
    topBarPublication({ owner: 'git-actions', actions: button('new') }),
  );
  const labels = () =>
    publishedTopBarActions(registry.get(topBarPublications)).map(
      (action) => action.label,
    );
  expect(labels()).toEqual(['new']);
  flush();
  expect(labels()).toEqual(['new']);
});

test('owners publish in a fixed order and leave when they unmount', () => {
  const { registry, flush } = scheduledRegistry(appIdleTTL);
  registry.mount(
    topBarPublication({ owner: 'git-actions', actions: button('Git') }),
  );
  const leave = registry.mount(
    topBarPublication({ owner: 'document-pane', actions: button('Timeline') }),
  );
  const labels = () =>
    publishedTopBarActions(registry.get(topBarPublications)).map(
      (action) => action.label,
    );
  expect(labels()).toEqual(['Timeline', 'Git']);
  leave();
  flush();
  expect(labels()).toEqual(['Git']);
});
