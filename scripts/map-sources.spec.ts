import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { areas } from '../design/server-lab/src/map/areas.ts';
import { coreSpecAudits } from '../design/server-lab/src/map/tests-core.ts';
import { serverSpecAudits } from '../design/server-lab/src/map/tests-server.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The map is a design workspace, but a map pointing at a file the rebuild moved
 * is worse than no map. Only paths are checked: line numbers shift on any edit
 * above them, so checking those would fail constantly and be silenced.
 */
it('points every map source reference at a file that exists', () => {
  const referenced: { owner: string; path: string }[] = [];
  const add = (owner: string, path: string | undefined) => {
    if (path) referenced.push({ owner, path });
  };

  for (const area of areas) {
    for (const flow of area.flows) {
      add(`${area.id}/${flow.id}`, flow.endpoint?.source.path);
      for (const trigger of flow.webTriggers)
        add(`${area.id}/${flow.id} web ${trigger.hook}`, trigger.source.path);
      if (flow.mcpTool)
        add(
          `${area.id}/${flow.id} mcp ${flow.mcpTool.name}`,
          flow.mcpTool.source.path,
        );
      for (const step of flow.steps)
        add(`${area.id}/${flow.id} step ${step.name}`, step.source.path);
    }
    for (const observation of area.observations)
      for (const source of observation.sources)
        add(`${area.id} observation "${observation.title}"`, source.path);
    for (const decision of area.decisions) {
      add(`${area.id} decision "${decision.title}"`, decision.source?.path);
      add(`${area.id} decision "${decision.title}"`, decision.doc);
    }
  }
  for (const audit of [...coreSpecAudits, ...serverSpecAudits])
    add(`spec audit ${audit.file}`, audit.file);

  expect(referenced.length).toBeGreaterThan(100);
  const missing = referenced.filter(
    ({ path }) => !existsSync(join(repoRoot, path)),
  );
  expect(
    missing.map(({ owner, path }) => `${owner} -> ${path}`),
    'map references point at files that no longer exist',
  ).toEqual([]);
});

/**
 * A path that exists is not the same as a path that is right. The route move
 * left every documented endpoint pointing at a URL the server no longer serves,
 * and the check above could not see it: the files were all still there.
 *
 * This stays deliberately literal — the declared path, minus the `/api` prefix
 * the server applies at registration, must appear in the file the map cites.
 * It reuses the reads that spec already does and adds no mechanism of its own.
 */
it('points every documented endpoint at a path its route file declares', () => {
  const endpoints: { owner: string; path: string; source: string }[] = [];
  for (const area of areas)
    for (const flow of area.flows)
      if (flow.endpoint)
        endpoints.push({
          owner: `${area.id}/${flow.id}`,
          path: flow.endpoint.path,
          source: flow.endpoint.source.path,
        });

  expect(endpoints.length).toBeGreaterThan(30);
  const wrong = endpoints.filter(({ path, source }) => {
    if (!path.startsWith('/api/')) return true;
    const declared = path.slice('/api'.length);
    const file = join(repoRoot, source);
    return !existsSync(file) || !readFileSync(file, 'utf8').includes(declared);
  });
  expect(
    wrong.map(
      ({ owner, path, source }) => `${owner}: ${path} not in ${source}`,
    ),
    'map endpoints must be under /api and declared by the file they cite',
  ).toEqual([]);
});
