import { existsSync } from 'node:fs';
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
