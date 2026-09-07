import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { cruise } from 'dependency-cruiser';
import { expect, test } from 'vitest';
import { boundaryRules } from './boundary-rules.ts';

async function violations(
  files: Record<string, string>,
  links: Record<string, string> = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-boundaries-'));
  const previousDirectory = process.cwd();
  try {
    for (const [path, source] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), source);
    }
    for (const [path, target] of Object.entries(links)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await symlink(join(root, target), join(root, path), 'dir');
    }
    process.chdir(root);
    const result = await cruise(
      Object.keys(files).filter((path) => path.endsWith('.ts')),
      {
        ...boundaryRules.options,
        ruleSet: boundaryRules,
        validate: true,
        outputType: 'json',
      },
    );
    if (typeof result.output !== 'string')
      throw new Error('Expected JSON report');
    const output = JSON.parse(result.output) as {
      modules: unknown[];
      summary: { violations: { rule: { name: string } }[] };
    };
    expect(output.modules.length).toBeGreaterThan(0);
    return output.summary.violations.map((violation) => violation.rule.name);
  } finally {
    process.chdir(previousDirectory);
    await rm(root, { recursive: true, force: true });
  }
}

test('allows imports inside an owner', async () => {
  expect(
    await violations({
      'apps/server/src/main.ts':
        "import { value } from './value.ts'; export const result = value;",
      'apps/server/src/value.ts': 'export const value = 1;',
    }),
  ).toEqual([]);
});

test('rejects application-to-application imports', async () => {
  expect(
    await violations({
      'apps/web/src/main.ts':
        "import { value } from '../../server/src/value.ts'; export const result = value;",
      'apps/server/src/value.ts': 'export const value = 1;',
    }),
  ).toContain('apps-web-dependencies');
});

test('rejects cycles', async () => {
  expect(
    await violations({
      'apps/server/src/a.ts': "export { b } from './b.ts'; export const a = 1;",
      'apps/server/src/b.ts': "export { a } from './a.ts'; export const b = 2;",
    }),
  ).toContain('no-cycles');
});

test('rejects Node builtins in portable code', async () => {
  expect(
    await violations({
      'packages/client/src/main.ts':
        "import { readFile } from 'node:fs/promises'; export const read = readFile;",
    }),
  ).toContain('no-node-in-portable-code');
});

test('rejects reaching into another package through relative paths', async () => {
  expect(
    await violations({
      'apps/server/src/main.ts':
        "import { value } from '../../../packages/contracts/src/value.ts'; export const result = value;",
      'packages/contracts/src/value.ts': 'export const value = 1;',
    }),
  ).toContain('use-package-exports');
});

test('rejects unresolved imports', async () => {
  expect(
    await violations({
      'apps/server/src/main.ts':
        "import { value } from './missing.ts'; export const result = value;",
    }),
  ).toContain('no-unresolved-imports');
});

test('rejects runtime imports into repository tooling', async () => {
  expect(
    await violations({
      'apps/server/src/main.ts':
        "import { value } from '../../../scripts/value.ts'; export const result = value;",
      'scripts/value.ts': 'export const value = 1;',
    }),
  ).toContain('apps-server-dependencies');
});

test('rejects Node builtins in mobile presentation', async () => {
  expect(
    await violations({
      'apps/mobile/src/main.ts':
        "import {readFile} from 'node:fs/promises'; export const read = readFile;",
    }),
  ).toContain('no-node-in-portable-code');
});

const exportedPackage = {
  'packages/contracts/package.json': JSON.stringify({
    name: '@porcelain/contracts',
    type: 'module',
    exports: { './value': './src/value.ts' },
  }),
  'packages/contracts/src/value.ts': 'export const value = 1;',
};
const workspaceLink = {
  'node_modules/@porcelain/contracts': 'packages/contracts',
};

test('resolves a workspace public subpath through its package exports', async () => {
  expect(
    await violations(
      {
        ...exportedPackage,
        'apps/server/src/main.ts':
          "import { value } from '@porcelain/contracts/value'; export const result = value;",
      },
      workspaceLink,
    ),
  ).toEqual([]);
});

test('rejects a private workspace subpath even when the source file exists', async () => {
  expect(
    await violations(
      {
        ...exportedPackage,
        'apps/server/src/main.ts':
          "import { value } from '@porcelain/contracts/src/value.ts'; export const result = value;",
      },
      workspaceLink,
    ),
  ).toContain('no-unresolved-imports');
});
