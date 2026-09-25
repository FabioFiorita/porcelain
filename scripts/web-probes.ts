import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { webPolicyFindings } from '../architecture/web-policy.ts';

const probes = [
  [
    'web-legacy-folder',
    'apps/web/src/query/client.ts',
    'export const client = 1',
  ],
  ['web-unowned-folder', 'apps/web/src/misc/file.ts', 'export const value = 1'],
  [
    'web-component-owner',
    'apps/web/src/components/card.tsx',
    'export const Card = () => null',
  ],
  [
    'web-no-runtime-fixture',
    'apps/web/src/features/review/fixture.ts',
    'export const value = 1',
  ],
  [
    'web-no-runtime-fixture',
    'apps/web/src/shared/api/mocks/server.ts',
    'export const value = 1',
  ],
  [
    'web-no-client-package',
    'apps/web/src/features/review/queries/a.ts',
    "import x from '@porcelain/client'",
  ],
  [
    'web-no-client-package',
    'apps/web/src/features/review/queries/a.ts',
    "import('@porcelain/client')",
  ],
  [
    'web-feature-boundary',
    'apps/web/src/features/review/views/a.tsx',
    "import x from '@/features/projects/model/x'",
  ],
  [
    'web-view-transport',
    'apps/web/src/features/review/views/a.tsx',
    "import x from '@/shared/api/client'",
  ],
  [
    'web-view-contracts',
    'apps/web/src/features/review/views/a.tsx',
    "import x from '@porcelain/contracts/reviews'",
  ],
  [
    'web-view-query-owner',
    'apps/web/src/features/review/views/a.tsx',
    "import { useQueryClient } from '@tanstack/react-query'",
  ],
  [
    'web-view-query-owner',
    'apps/web/src/features/review/views/a.tsx',
    "import x from '@/shared/query/client'",
  ],
  [
    'web-view-query-owner',
    'apps/web/src/features/review/views/a.tsx',
    "import x from '@/features/review/api/review-live'",
  ],
  [
    'web-view-query-owner',
    'apps/web/src/app/views/a.tsx',
    "import x from '@/app/api'",
  ],
  [
    'web-transport-owner',
    'apps/web/src/features/review/queries/a.ts',
    "fetch('/api/inventory')",
  ],
  [
    'web-transport-owner',
    'apps/web/src/routes/a.tsx',
    "new WebSocket('/api/live')",
  ],
  [
    'web-transport-owner',
    'apps/web/src/routes/a.tsx',
    "window.fetch('/api/inventory')",
  ],
  [
    'web-transport-owner',
    'apps/web/src/routes/a.tsx',
    "new globalThis.EventSource('/api/live')",
  ],
  [
    'web-browser-no-mocks',
    'apps/web/spec/browser/a.browser.ts',
    "import { vi } from 'vitest'; vi.mock('client')",
  ],
  [
    'web-browser-no-skips',
    'apps/web/spec/browser/a.browser.ts',
    "import { test } from 'vitest'; test.skip('case', () => {})",
  ],
  [
    'web-browser-spec-name',
    'apps/web/spec/browser/a.spec.ts',
    "import { test } from 'vitest'; test('case', () => {})",
  ],
] as const;

let failed = 0;
for (const [rule, file, source] of probes) {
  const rejected = webPolicyFindings(file, source).some(
    (finding) => finding.rule === rule,
  );
  process.stdout.write(`${rejected ? 'REJECTED' : 'MISSED'} ${rule} ${file}\n`);
  if (!rejected) failed += 1;
}
const permitted = webPolicyFindings(
  'apps/web/src/shared/api/client.ts',
  "export const load = () => fetch('/api/inventory')",
);
if (permitted.length > 0) {
  process.stderr.write(
    `Permitted transport rejected: ${JSON.stringify(permitted)}\n`,
  );
  failed += 1;
}
const viewState = webPolicyFindings(
  'apps/web/src/features/review/views/a.tsx',
  "import { useEffect, useRef, useState } from 'react'",
);
if (viewState.length > 0) {
  process.stderr.write(
    `Permitted view state rejected: ${JSON.stringify(viewState)}\n`,
  );
  failed += 1;
}
const pluginProbe = 'apps/web/src/routes/.web-lint-probe.tsx';
if (existsSync(pluginProbe)) throw new Error(`${pluginProbe} already exists`);
try {
  writeFileSync(
    pluginProbe,
    'import { Button } from \'@/components/ui/button\'; export const Probe = () => <Button className="p-4 bg-red-500">Save</Button>;',
  );
  const result = spawnSync('pnpm', ['exec', 'oxlint', pluginProbe], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  for (const rule of ['shadcn(no-restyle)', 'shadcn(no-raw-colors)']) {
    const rejected = output.includes(rule);
    process.stdout.write(`${rejected ? 'REJECTED' : 'MISSED'} ${rule}\n`);
    if (!rejected) failed += 1;
  }
} finally {
  rmSync(pluginProbe, { force: true });
}
if (failed > 0) process.exitCode = 1;
