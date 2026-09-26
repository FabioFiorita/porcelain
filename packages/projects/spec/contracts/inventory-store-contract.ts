import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RegisteredProject } from '../../src/models/project.ts';
import type { InventoryStore } from '../../src/ports/inventory-store.ts';

export type InventoryStoreSubject = {
  store: InventoryStore;
  close: () => void;
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
  openSubject: () => InventoryStoreSubject,
): void {
  describe(subject, () => {
    let opened: InventoryStoreSubject;
    let store: InventoryStore;

    beforeEach(() => {
      opened = openSubject();
      store = opened.store;
    });

    afterEach(() => {
      opened.close();
    });

    it('reads an empty inventory before any project is saved', () => {
      expect(store.read()).toEqual({ projects: [] });
    });

    it('reads every saved project in position order, whatever order they were saved in', () => {
      store.save(project('third', 3));
      store.save(project('first', 1));
      store.save(project('second', 2));
      expect(store.read()).toEqual({
        projects: [
          project('first', 1),
          project('second', 2),
          project('third', 3),
        ],
      });
    });

    it('replaces a project saved again under the same id', () => {
      store.save(project('api', 1));
      const renamed = { ...project('api', 2), name: 'API', namedByOwner: true };
      store.save(renamed);
      expect(store.read()).toEqual({ projects: [renamed] });
    });

    it('finds a saved project by id', () => {
      store.save(project('api', 1));
      store.save(project('web', 2));
      expect(store.find({ projectId: 'web' })).toEqual(project('web', 2));
    });

    it('finds nothing for an unknown project id', () => {
      store.save(project('api', 1));
      expect(store.find({ projectId: 'unknown' })).toBeUndefined();
    });

    it('marks every project unavailable and keeps everything else', () => {
      store.save(project('api', 1));
      store.save({ ...project('web', 2), available: false });
      store.markAllUnavailable();
      expect(store.read()).toEqual({
        projects: [
          { ...project('api', 1), available: false },
          { ...project('web', 2), available: false },
        ],
      });
    });

    it('removes only the asked project', () => {
      store.save(project('api', 1));
      store.save(project('web', 2));
      store.remove({ projectId: 'api' });
      expect(store.find({ projectId: 'api' })).toBeUndefined();
      expect(store.read()).toEqual({ projects: [project('web', 2)] });
    });

    it('leaves the inventory unchanged when an unknown project is removed', () => {
      store.save(project('api', 1));
      store.remove({ projectId: 'unknown' });
      expect(store.read()).toEqual({ projects: [project('api', 1)] });
    });

    it('hands out copies, so changing a returned project leaves the stored one unchanged', () => {
      const saved = project('api', 1);
      store.save(saved);
      saved.name = 'Changed after saving';
      Object.assign(store.find({ projectId: 'api' }) ?? {}, {
        name: 'Changed after finding',
      });
      Object.assign(store.read().projects.at(0) ?? {}, {
        name: 'Changed after reading',
      });
      expect(store.find({ projectId: 'api' })).toEqual(project('api', 1));
    });
  });
}
