import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function lintFixture(path, source) {
  const directory = mkdtempSync(join(tmpdir(), 'porcelain-lint-rule-'));
  try {
    const file = join(directory, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          paths: {
            '@porcelain/contracts/projects': [
              join(root, 'packages/contracts/src/projects/index.ts'),
            ],
          },
        },
        include: ['**/*.ts'],
      }),
    );
    const result = spawnSync(
      join(root, 'node_modules/.bin/oxlint'),
      ['--type-aware', '--config', join(root, '.oxlintrc.json'), file],
      { cwd: root, encoding: 'utf8' },
    );
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('server lint conventions', () => {
  it('accepts a typed controller using one execute method', () => {
    const result = lintFixture(
      'apps/server/src/controllers/read-project-controller.ts',
      "export class ReadProjectController { execute(): string { return 'https://example.test'; } }\n",
    );
    assert.equal(result.status, 0, result.output);
  });

  it('rejects schema parsing through an alias and an extra public method', () => {
    const result = lintFixture(
      'apps/server/src/controllers/read-project-controller.ts',
      'const input = { safeParse: () => true }; export class ReadProjectController { execute(): boolean { return input.safeParse(); } inspect(): boolean { return true; } }\n',
    );
    assert.equal(result.status, 1);
    assert.match(result.output, /no-schema-parse-in-typed-code/);
    assert.match(result.output, /expose only execute/);
  });

  it('accepts a feature route with schemas and one controller call', () => {
    const result = lintFixture(
      'apps/server/src/http/routes/projects/rename.ts',
      "import { projectResponseSchema } from '@porcelain/contracts/projects'; const api = { patch(_path, _options, _handler) {} }; const options = { controller: { execute() {} } }; api.patch('/projects/:id', { schema: { response: { 200: projectResponseSchema } } }, () => options.controller.execute());\n",
    );
    assert.equal(result.status, 0, result.output);
  });

  it('rejects a feature route with an inline response and no controller', () => {
    const result = lintFixture(
      'apps/server/src/http/routes/projects/rename.ts',
      "const api = { patch(_path, _options, _handler) {} }; const options = { application: { rename() {} } }; api.patch('/projects/:id', { schema: { response: { 200: {} } } }, () => options.application.rename());\n",
    );
    assert.equal(result.status, 1);
    assert.match(result.output, /feature-route-shape/);
  });
});
