import { describe, expect, it } from 'vitest';
import {
  FilePreferenceLimitError,
  ProjectNotFoundError,
} from '@porcelain/contracts/projects';
import { runRequest } from '@porcelain/client/transport';
import { projectsApi } from './api.ts';

const projectId = '21c20d74-aee9-4293-b9d2-66b6a4d46c26';
const signal = new AbortController().signal;

describe('generated Projects client', () => {
  it('omits an absent browse path and encodes reserved characters once', async () => {
    const paths: string[] = [];
    const api = projectsApi({
      transport: (path) => {
        paths.push(path);
        return Promise.resolve(
          Response.json({
            path: '/',
            parent: null,
            directories: [],
            repository: false,
            truncated: false,
          }),
        );
      },
    });
    await expect(
      runRequest(api.browseProjectFolders({ query: {} }), signal),
    ).resolves.toMatchObject({ parent: undefined });
    await runRequest(
      api.browseProjectFolders({ query: { path: '/srv/a b/#?' } }),
      signal,
    );
    expect(paths).toEqual([
      '/api/projects/folders',
      '/api/projects/folders?path=%2Fsrv%2Fa+b%2F%23%3F',
    ]);
  });
  it('validates the rename body before sending it', async () => {
    const sent: { path: string; init: RequestInit | undefined }[] = [];
    const api = projectsApi({
      transport: (path, init) => {
        sent.push({ path, init });
        return Promise.resolve(
          Response.json({ id: projectId, name: 'Renamed' }),
        );
      },
    });
    await expect(
      runRequest(
        api.renameProject({
          params: { projectId },
          payload: { name: 'Renamed' },
        }),
        signal,
      ),
    ).resolves.toEqual({ id: projectId, name: 'Renamed' });
    expect(sent[0]).toMatchObject({
      path: `/api/projects/${projectId}`,
      init: {
        method: 'PATCH',
        cache: 'no-store',
        redirect: 'error',
        headers: { 'content-type': 'application/json' },
      },
    });
    const body = sent[0]?.init?.body;
    expect(body).toBeInstanceOf(Uint8Array);
    if (!(body instanceof Uint8Array))
      throw new Error('Expected a JSON request encoded as bytes');
    expect(new TextDecoder().decode(body)).toBe('{"name":"Renamed"}');
    await expect(
      runRequest(
        api.renameProject({ params: { projectId }, payload: { name: '' } }),
        signal,
      ),
    ).rejects.toThrow();
    expect(sent).toHaveLength(1);
  });
  it('decodes the existing preference capacity conflict into the declared failure', async () => {
    const api = projectsApi({
      transport: () =>
        Promise.resolve(
          Response.json(
            {
              statusCode: 409,
              error: 'Conflict',
              message: 'File preference limit reached',
            },
            { status: 409 },
          ),
        ),
    });
    const failure = await runRequest(
      api.setFilePreference({
        params: { projectId },
        payload: { path: 'README.md', flag: 'pinned', value: true },
      }),
      signal,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(FilePreferenceLimitError);
  });
  it('requires the correct status and message to decode a missing project', async () => {
    const valid = projectsApi({
      transport: () =>
        Promise.resolve(
          Response.json(
            {
              statusCode: 404,
              error: 'Not Found',
              message: new ProjectNotFoundError().message,
            },
            { status: 404 },
          ),
        ),
    });
    const invalid = projectsApi({
      transport: () =>
        Promise.resolve(
          Response.json(
            {
              statusCode: 409,
              error: 'Conflict',
              message: new ProjectNotFoundError().message,
            },
            { status: 409 },
          ),
        ),
    });
    expect(
      await runRequest(
        valid.renameProject({
          params: { projectId },
          payload: { name: 'Renamed' },
        }),
        signal,
      ).catch((error: unknown) => error),
    ).toBeInstanceOf(ProjectNotFoundError);
    expect(
      await runRequest(
        invalid.renameProject({
          params: { projectId },
          payload: { name: 'Renamed' },
        }),
        signal,
      ).catch((error: unknown) => error),
    ).not.toBeInstanceOf(ProjectNotFoundError);
  });
});
