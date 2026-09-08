import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  artifactContentSchema,
  artifactMetadataSchema,
} from '@porcelain/contracts/artifacts';
import { projectResponseSchema } from '@porcelain/contracts/inventory';
import { expect, it } from 'vitest';
import { openDatabase } from '../../db/connection.ts';
import { artifactLimits } from '../../models/artifact.ts';
import { ArtifactRepository } from '../../repositories/artifact-repository.ts';
import { createServer } from '../server.ts';

const token = 'fixture-token-with-at-least-32-characters';
const headers = { authorization: `Bearer ${token}` };
async function fixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'porcelain-artifact-http-')),
  );
  const path = join(root, 'project');
  await mkdir(path);
  execFileSync('git', ['init', '-b', 'main', path]);
  const options = { dataDirectory: join(root, 'state'), token };
  const server = await createServer(options);
  const response = await server.inject({
    method: 'POST',
    url: '/projects',
    headers,
    payload: { path },
  });
  const project = projectResponseSchema.parse(response.json());
  const worktree = project.worktrees[0];
  if (!worktree) throw new Error('Missing fixture worktree');
  return {
    root,
    path,
    options,
    server,
    collection: `/worktrees/${worktree.id}/artifacts`,
    worktreeId: worktree.id,
  };
}

it('uploads and retrieves inert HTML over real authenticated JSON, preserving content through refresh and restart outside Git', async () => {
  const f = await fixture();
  const input = {
    name: '../../<img src=x onerror=alert(1)>.html',
    content:
      '<!doctype html><script>fetch("https://evil.invalid")</script>😀\u0000',
  };
  try {
    const address = await f.server.listen({ host: '127.0.0.1', port: 0 });
    const upload = await fetch(`${address}${f.collection}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(upload.status).toBe(201);
    const metadata = artifactMetadataSchema.parse(await upload.json());
    expect(metadata).toMatchObject({
      worktreeId: f.worktreeId,
      name: input.name,
      sizeBytes: Buffer.byteLength(input.content),
    });
    expect(await readdir(f.path)).toEqual(['.git']);
    await f.server.inject({
      method: 'POST',
      url: '/inventory/refresh',
      headers,
    });
    await f.server.close();
    const restarted = await createServer(f.options);
    try {
      const listing = await restarted.inject({
        method: 'GET',
        url: f.collection,
        headers,
      });
      expect(listing.json()).toEqual([metadata]);
      const item = `${f.collection}/${metadata.id}`;
      const retrieval = await restarted.inject({
        method: 'GET',
        url: item,
        headers: { ...headers, accept: 'text/html' },
      });
      expect(retrieval.statusCode).toBe(200);
      expect(retrieval.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      );
      expect(retrieval.headers['x-content-type-options']).toBe('nosniff');
      expect(retrieval.headers['cache-control']).toBe('no-store');
      expect(artifactContentSchema.parse(retrieval.json())).toEqual({
        ...metadata,
        content: input.content,
      });
      const otherPath = join(f.root, 'other');
      await mkdir(otherPath);
      execFileSync('git', ['init', '-b', 'main', otherPath]);
      const other = projectResponseSchema.parse(
        (
          await restarted.inject({
            method: 'POST',
            url: '/projects',
            headers,
            payload: { path: otherPath },
          })
        ).json(),
      ).worktrees[0];
      if (!other) throw new Error('Missing second worktree');
      const otherCollection = `/worktrees/${other.id}/artifacts`;
      expect(
        (
          await restarted.inject({
            method: 'GET',
            url: otherCollection,
            headers,
          })
        ).json(),
      ).toEqual([]);
      expect(
        (
          await restarted.inject({
            method: 'GET',
            url: `${otherCollection}/${metadata.id}`,
            headers,
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await restarted.inject({
            method: 'DELETE',
            url: `${otherCollection}/${metadata.id}`,
            headers,
          })
        ).json(),
      ).toEqual({ deleted: false });
      expect(
        (await restarted.inject({ method: 'GET', url: item, headers }))
          .statusCode,
      ).toBe(200);
      expect(
        (
          await restarted.inject({ method: 'DELETE', url: item, headers })
        ).json(),
      ).toEqual({ deleted: true });
      expect(
        (
          await restarted.inject({ method: 'DELETE', url: item, headers })
        ).json(),
      ).toEqual({ deleted: false });
      expect(
        (await restarted.inject({ method: 'GET', url: item, headers }))
          .statusCode,
      ).toBe(404);
    } finally {
      await restarted.close();
    }
    const reopened = await createServer(f.options);
    try {
      expect(
        (
          await reopened.inject({ method: 'GET', url: f.collection, headers })
        ).json(),
      ).toEqual([]);
    } finally {
      await reopened.close();
    }
  } finally {
    await f.server.close();
    await rm(f.root, { recursive: true, force: true });
  }
});

it('authenticates all artifact routes before parsing and rejects unknown scope and caller path fields', async () => {
  const f = await fixture();
  try {
    for (const [method, url] of [
      ['POST', f.collection],
      ['GET', f.collection],
      ['GET', `${f.collection}/${randomUUID()}`],
      ['DELETE', `${f.collection}/${randomUUID()}`],
    ] as const) {
      const response = await f.server.inject({
        method,
        url,
        headers: {
          authorization: 'Bearer wrong',
          'content-type': 'application/json',
        },
        payload: '{bad json',
      });
      expect(response.statusCode).toBe(401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    for (const method of ['POST', 'GET', 'DELETE'] as const) {
      const url = `/worktrees/${randomUUID()}/artifacts${method === 'DELETE' ? `/${randomUUID()}` : ''}`;
      expect(
        (
          await f.server.inject({
            method,
            url,
            headers,
            ...(method === 'POST'
              ? { payload: { name: 'x', content: 'x' } }
              : {}),
          })
        ).statusCode,
      ).toBe(404);
    }
    expect(
      (
        await f.server.inject({
          method: 'POST',
          url: f.collection,
          headers,
          payload: { name: 'x', content: 'x', path: '/tmp/escape.html' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await f.server.inject({
          method: 'GET',
          url: `${f.collection}/..%2F..%2Fescape`,
          headers,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await f.server.inject({ method: 'GET', url: f.collection, headers })
      ).json(),
    ).toEqual([]);
  } finally {
    await f.server.close();
    await rm(f.root, { recursive: true, force: true });
  }
});

it('rejects malformed UTF-8 and Unicode, bounds request bytes, and accepts exact content limit with escaped JSON', async () => {
  const f = await fixture();
  try {
    const jsonHeaders = { ...headers, 'content-type': 'application/json' };
    const malformed = Buffer.concat([
      Buffer.from('{"name":"x","content":"'),
      Buffer.from([0xc3, 0x28]),
      Buffer.from('"}'),
    ]);
    for (const payload of [
      malformed,
      '{"name":"x","content":"\\ud800"}',
      JSON.stringify({
        name: 'x',
        content: 'é'.repeat(artifactLimits.contentBytes / 2 + 1),
      }),
      ' '.repeat(artifactLimits.contentBytes * 6 + 4097),
    ]) {
      expect(
        (
          await f.server.inject({
            method: 'POST',
            url: f.collection,
            headers: jsonHeaders,
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    expect(
      (
        await f.server.inject({ method: 'GET', url: f.collection, headers })
      ).json(),
    ).toEqual([]);
    const payload = `{"name":"limit","content":"${'\\u0061'.repeat(artifactLimits.contentBytes)}"}`;
    const accepted = await f.server.inject({
      method: 'POST',
      url: f.collection,
      headers: jsonHeaders,
      payload,
    });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json()).toMatchObject({
      sizeBytes: artifactLimits.contentBytes,
    });
  } finally {
    await f.server.close();
    await rm(f.root, { recursive: true, force: true });
  }
});

it('reports aggregate quota exhaustion safely through HTTP and permits recovery by deletion', async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    for (const _ of Array.from({ length: 16 })) {
      const response = await f.server.inject({
        method: 'POST',
        url: f.collection,
        headers,
        payload: {
          name: 'full',
          content: 'x'.repeat(artifactLimits.contentBytes),
        },
      });
      expect(response.statusCode).toBe(201);
      ids.push(artifactMetadataSchema.parse(response.json()).id);
    }
    const rejected = await f.server.inject({
      method: 'POST',
      url: f.collection,
      headers,
      payload: { name: 'overflow', content: 'x' },
    });
    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toEqual({
      code: 'ARTIFACT_QUOTA_EXCEEDED',
      message: 'Artifact storage quota exceeded',
    });
    await f.server.inject({
      method: 'DELETE',
      url: `${f.collection}/${ids[0]}`,
      headers,
    });
    expect(
      (
        await f.server.inject({
          method: 'POST',
          url: f.collection,
          headers,
          payload: { name: 'recovered', content: 'x' },
        })
      ).statusCode,
    ).toBe(201);
  } finally {
    await f.server.close();
    await rm(f.root, { recursive: true, force: true });
  }
});

it('retains removed worktree storage while denying access through its absent inventory identity', async () => {
  const f = await fixture();
  try {
    execFileSync('git', [
      '-C',
      f.path,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '--allow-empty',
      '-m',
      'fixture',
    ]);
    const linked = join(f.root, 'linked');
    execFileSync('git', [
      '-C',
      f.path,
      'worktree',
      'add',
      '-b',
      'linked',
      linked,
    ]);
    await f.server.inject({
      method: 'POST',
      url: '/inventory/refresh',
      headers,
    });
    const inventory = (
      await f.server.inject({ method: 'GET', url: '/inventory', headers })
    ).json();
    const project = projectResponseSchema.parse(inventory.projects[0]);
    const worktree = project.worktrees.find((entry) => !entry.main);
    if (!worktree) throw new Error('Missing linked worktree');
    const collection = `/worktrees/${worktree.id}/artifacts`;
    const uploaded = await f.server.inject({
      method: 'POST',
      url: collection,
      headers,
      payload: { name: 'retained', content: 'x' },
    });
    const metadata = artifactMetadataSchema.parse(uploaded.json());
    execFileSync('git', ['-C', f.path, 'worktree', 'remove', linked]);
    await f.server.inject({
      method: 'POST',
      url: '/inventory/refresh',
      headers,
    });
    for (const [method, url] of [
      ['GET', collection],
      ['GET', `${collection}/${metadata.id}`],
      ['DELETE', `${collection}/${metadata.id}`],
    ] as const) {
      expect((await f.server.inject({ method, url, headers })).statusCode).toBe(
        404,
      );
    }
    await f.server.close();
    const database = openDatabase(f.options.dataDirectory);
    try {
      expect(
        new ArtifactRepository(database.db).get(worktree.id, metadata.id),
      ).toEqual({ ...metadata, content: 'x' });
    } finally {
      database.close();
    }
  } finally {
    await f.server.close();
    await rm(f.root, { recursive: true, force: true });
  }
});
