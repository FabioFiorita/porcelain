import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  digest,
  pinsFile,
  uiFiles,
  uiFolder,
} from '../architecture/shadcn-pins.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const copied = [
  'components.json',
  'package.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'src/app.css',
];

function run(program: string, args: readonly string[]): void {
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${program} ${args.join(' ')} failed:\n${result.stderr}`);
}

const names = uiFiles(root);
const scratch = mkdtempSync(join(tmpdir(), 'porcelain-shadcn-pin-'));
try {
  const web = join(scratch, 'apps', 'web');
  mkdirSync(join(web, 'src'), { recursive: true });
  cpSync(join(root, 'tsconfig.json'), join(scratch, 'tsconfig.json'));
  for (const file of copied)
    cpSync(join(root, 'apps', 'web', file), join(web, file));
  run(join(root, 'apps', 'web', 'node_modules', '.bin', 'shadcn'), [
    'add',
    ...names.map((name) => name.slice(0, -'.tsx'.length)),
    '--overwrite',
    '--yes',
    '--silent',
    '--cwd',
    web,
  ]);
  const installed = names.map((name) =>
    join(web, 'src', 'components', 'ui', name),
  );
  run(join(root, 'node_modules', '.bin', 'oxfmt'), [
    '--config',
    join(root, '.oxfmtrc.json'),
    ...installed,
  ]);
  const pins = Object.fromEntries(
    names.map((name, index) => [
      name,
      digest(readFileSync(installed[index] ?? '', 'utf8')),
    ]),
  );
  writeFileSync(join(root, pinsFile), `${JSON.stringify(pins, null, 2)}\n`);
  const edited = names.filter(
    (name) =>
      digest(readFileSync(join(root, uiFolder, name), 'utf8')) !== pins[name],
  );
  process.stdout.write(
    `Pinned ${names.length} components/ui files as the shadcn registry serves them.\n${edited.map((name) => `differs from the registry: ${uiFolder}/${name}\n`).join('')}`,
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
