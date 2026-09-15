import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { CliCommitGenerator } from './cli-commit-generator.ts';

it('discovers local models and invokes an isolated, tool-disabled CLI using stdin and structured output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-generator-'));
  const log = join(root, 'args.json');
  await mkdir(join(root, '.codex'));
  await writeFile(
    join(root, '.codex/models_cache.json'),
    JSON.stringify({
      models: [
        {
          slug: 'fixture-model',
          display_name: 'Fixture model',
          visibility: 'list',
        },
        { slug: 'hidden-model', display_name: 'Hidden', visibility: 'hide' },
      ],
    }),
  );
  const script = `#!${process.execPath}\nconst fs = require('node:fs'); const args=process.argv.slice(2); let input=''; process.stdin.on('data', c=>input+=c); process.stdin.on('end',()=>{fs.writeFileSync(${JSON.stringify(log)},JSON.stringify({args,input,cwd:process.cwd()})); const result={groups:[{message:'A fixture commit',paths:['a.ts']}]}; const out=args.indexOf('--output-last-message'); if(out>=0) fs.writeFileSync(args[out+1],JSON.stringify(result)); else process.stdout.write(JSON.stringify({structured_output:result}));});\n`;
  for (const name of ['codex', 'claude']) {
    await writeFile(join(root, name), script);
    await chmod(join(root, name), 0o700);
  }
  vi.stubEnv('PATH', root);
  vi.stubEnv('CODEX_HOME', join(root, '.codex'));
  try {
    const generator = new CliCommitGenerator();
    expect(
      (await generator.models(AbortSignal.timeout(5000))).map(
        (model) => model.id,
      ),
    ).toEqual(['codex:fixture-model', 'claude:sonnet', 'claude:haiku']);
    expect(
      await generator.generate(
        'codex:fixture-model',
        'Source content',
        AbortSignal.timeout(5000),
      ),
    ).toEqual([{ message: 'A fixture commit', paths: ['a.ts'] }]);
    for (const model of [
      'codex:default',
      'claude:default',
      'codex:fixture-model:extra',
    ])
      await expect(
        generator.generate(model, 'Source', AbortSignal.timeout(5000)),
      ).rejects.toThrow('Unsupported commit model');
    const recorded = JSON.parse(await readFile(log, 'utf8'));
    expect(recorded.input).toBe('Source content');
    expect(recorded.args).toEqual(
      expect.arrayContaining([
        '--ignore-user-config',
        '--ephemeral',
        '--sandbox',
        'read-only',
        'shell_tool',
        '--model',
        'fixture-model',
      ]),
    );
    expect(recorded.cwd).not.toBe(process.cwd());
    await generator.generate(
      'claude:sonnet',
      'Source content',
      AbortSignal.timeout(5000),
    );
    expect(JSON.parse(await readFile(log, 'utf8')).args).toEqual(
      expect.arrayContaining([
        '--model',
        'sonnet',
        '--safe-mode',
        '--restricted',
        '--tools',
        '',
        '--strict-mcp-config',
      ]),
    );
    await rm(join(root, '.codex/models_cache.json'));
    await rm(join(root, 'claude'));
    expect(await generator.models(AbortSignal.timeout(5000))).toEqual([]);
  } finally {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  }
});
