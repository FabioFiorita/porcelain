import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RegisteredProject } from '../../src/models/project.ts';
import type { InventoryStore } from '../../src/ports/inventory-store.ts';

export type InventoryStoreSubject = {
  store: InventoryStore;
  close: () => Promise<void> | void;
};

function project(id: string, position: number): RegisteredProject {
  return {
    id,
    name: `Project ${id}`,
    namedByOwner: false,
    commonDirectory: `/repositories/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position,
  };
}

export function inventoryStoreContract(
  subject: string,
  openSubject: () => InventoryStoreSubject | Promise<InventoryStoreSubject>,
): void {
  describe(subject, () => {
    let opened: InventoryStoreSubject;
    let store: InventoryStore;

    beforeEach(async () => {
      opened = await openSubject();
      store = opened.store;
    });

    afterEach(async () => {
      await opened.close();
    });

    it('reads an empty inventory before any project is saved', async () => {
      expect(await Effect.runPromise(store.read())).toEqual({ projects: [] });
    });

    it('reads every saved project in position order, whatever order they were saved in', async () => {
      await Effect.runPromise(store.save(project('third', 3)));
      await Effect.runPromise(store.save(project('first', 1)));
      await Effect.runPromise(store.save(project('second', 2)));
      expect(await Effect.runPromise(store.read())).toEqual({
        projects: [
          project('first', 1),
          project('second', 2),
          project('third', 3),
        ],
      });
    });

    it('replaces a project saved again under the same id', async () => {
      await Effect.runPromise(store.save(project('api', 1)));
      const renamed = { ...project('api', 2), name: 'API', namedByOwner: true };
      await Effect.runPromise(store.save(renamed));
      expect(await Effect.runPromise(store.read())).toEqual({
        projects: [renamed],
      });
    });

    it('finds a saved project by id', async () => {
      await Effect.runPromise(store.save(project('api', 1)));
      await Effect.runPromise(store.save(project('web', 2)));
      expect(await Effect.runPromise(store.find({ projectId: 'web' }))).toEqual(
        project('web', 2),
      );
    });

    it('finds nothing for an unknown project id', async () => {
      await Effect.runPromise(store.save(project('api', 1)));
      expect(
        await Effect.runPromise(store.find({ projectId: 'unknown' })),
      ).toBeUndefined();
    });

    it('marks every project unavailable and keeps everything else', async () => {
      await Effect.runPromise(store.save(project('api', 1)));
      await Effect.runPromise(
        store.save({ ...project('web', 2), available: false }),
      );
      await Effect.runPromise(store.markAllUnavailable());
      expect(await Effect.runPromise(store.read())).toEqual({
        projects: [
          { ...project('api', 1), available: false },
          { ...project('web', 2), available: false },
        ],
      });
    });

    it('removes only the asked project', async () => {
      await Effect.runPromise(store.save(project('api', 1)));
      await Effect.runPromise(store.save(project('web', 2)));
      await Effect.runPromise(store.remove({ projectId: 'api' }));
      expect(
        await Effect.runPromise(store.find({ projectId: 'api' })),
      ).toBeUndefined();
      expect(await Effect.runPromise(store.read())).toEqual({
        projects: [project('web', 2)],
      });
    });

    it('leaves the inventory unchanged when an unknown project is removed', async () => {
      await Effect.runPromise(store.save(project('api', 1)));
      await Effect.runPromise(store.remove({ projectId: 'unknown' }));
      expect(await Effect.runPromise(store.read())).toEqual({
        projects: [project('api', 1)],
      });
    });

    it('hands out copies, so changing a returned project leaves the stored one unchanged', async () => {
      const saved = project('api', 1);
      await Effect.runPromise(store.save(saved));
      saved.name = 'Changed after saving';
      Object.assign(
        (await Effect.runPromise(store.find({ projectId: 'api' }))) ?? {},
        {
          name: 'Changed after finding',
        },
      );
      Object.assign(
        (await Effect.runPromise(store.read())).projects.at(0) ?? {},
        {
          name: 'Changed after reading',
        },
      );
      expect(await Effect.runPromise(store.find({ projectId: 'api' }))).toEqual(
        project('api', 1),
      );
    });
  });
}
