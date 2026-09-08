import { describe, expect, it, vi } from 'vitest';
import { artifactLimits } from '../models/artifact.ts';
import type { ArtifactStore } from '../repositories/interfaces/artifact-store.ts';
import type { InventoryStore } from '../repositories/interfaces/inventory-store.ts';
import { DeleteArtifact } from './delete-artifact.ts';
import { ArtifactNotFoundError } from './errors/artifact-not-found-error.ts';
import { InvalidArtifactError } from './errors/invalid-artifact-error.ts';
import { WorktreeNotFoundError } from './errors/worktree-not-found-error.ts';
import { GetArtifact } from './get-artifact.ts';
import { ListArtifacts } from './list-artifacts.ts';
import { UploadArtifact } from './upload-artifact.ts';

describe('Artifacts', () => {
  const inventory: Pick<InventoryStore, 'read'> = {
    read: () => ({
      environmentId: 'environment',
      projects: [
        {
          id: 'project',
          name: 'fixture',
          commonDirectory: '/unused',
          repositoryIdentity: 'identity',
          available: false,
          worktrees: [
            {
              id: 'worktree',
              path: '/unused',
              metadataIdentity: null,
              main: true,
              branch: null,
              available: false,
            },
          ],
        },
      ],
    }),
  };
  const metadata = {
    id: 'artifact',
    worktreeId: 'worktree',
    name: '../../<script>.html',
    sizeBytes: 4,
    createdAt: '2026-09-07T00:00:00.000Z',
  };
  function fixture() {
    const store = {
      create: vi.fn<ArtifactStore['create']>(() => metadata),
      list: vi.fn<ArtifactStore['list']>(() => [metadata]),
      get: vi.fn<ArtifactStore['get']>(() => ({ ...metadata, content: '😀' })),
      delete: vi.fn<ArtifactStore['delete']>(() => false),
    } satisfies ArtifactStore;
    return {
      store,
      upload: new UploadArtifact(store, inventory),
      list: new ListArtifacts(store, inventory),
      get: new GetArtifact(store, inventory),
      remove: new DeleteArtifact(store, inventory),
    };
  }

  it('accepts inert display names and counts UTF-8 bytes for unavailable registered worktrees', () => {
    const { upload, store } = fixture();
    const input = { name: metadata.name, content: '😀' };
    expect(upload.execute('worktree', input)).toEqual(metadata);
    expect(store.create).toHaveBeenCalledWith('worktree', input, 4);
  });

  it('rejects invalid Unicode, empty content, excessive names and the byte limit before persistence', () => {
    const { upload, store } = fixture();
    for (const input of [
      { name: 'x', content: '' },
      { name: '', content: 'x' },
      { name: 'x'.repeat(257), content: 'x' },
      { name: '\ud800', content: 'x' },
      { name: 'x', content: '\udfff' },
      { name: 'x', content: 'é'.repeat(artifactLimits.contentBytes / 2 + 1) },
    ])
      expect(() => upload.execute('worktree', input)).toThrow(
        InvalidArtifactError,
      );
    expect(store.create).not.toHaveBeenCalled();
    const content = 'é'.repeat(artifactLimits.contentBytes / 2);
    upload.execute('worktree', { name: 'limit', content });
    expect(store.create).toHaveBeenCalledWith(
      'worktree',
      { name: 'limit', content },
      artifactLimits.contentBytes,
    );
  });

  it('requires registered scope for every operation without touching artifact storage', () => {
    const { upload, list, get, remove, store } = fixture();
    for (const operation of [
      () => upload.execute('unknown', { name: 'x', content: 'x' }),
      () => list.execute('unknown'),
      () => get.execute('unknown', 'artifact'),
      () => remove.execute('unknown', 'artifact'),
    ])
      expect(operation).toThrow(WorktreeNotFoundError);
    for (const method of Object.values(store))
      expect(method).not.toHaveBeenCalled();
  });

  it('returns scoped metadata, reports missing content and makes repeated deletion harmless', () => {
    const { list, get, remove, store } = fixture();
    expect(list.execute('worktree')).toEqual([metadata]);
    expect(get.execute('worktree', 'artifact').content).toBe('😀');
    store.get.mockReturnValue(undefined);
    expect(() => get.execute('worktree', 'missing')).toThrow(
      ArtifactNotFoundError,
    );
    expect(remove.execute('worktree', 'missing')).toEqual({ deleted: false });
    expect(store.delete).toHaveBeenCalledWith('worktree', 'missing');
  });
});
