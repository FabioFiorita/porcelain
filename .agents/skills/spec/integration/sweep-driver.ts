import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { sweep } from '../../web-verify/scripts/sweep.ts';
import { registry } from '../../web-verify/scripts/instance.ts';
import { runCli } from '../../verify-core/cli.ts';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const capture: NonNullable<Parameters<typeof sweep>[2]> = async (
  _signed,
  _url,
  shot,
  file,
) => {
  await writeFile(file, onePixelPng);
  shot.file = file;
};
if (import.meta.main)
  await runCli(async () => {
    const args = process.argv.slice(2);
    const { values } = parseArgs({
      args,
      options: {
        instance: { type: 'string' },
        board: { type: 'string', multiple: true },
      },
      allowPositionals: true,
    });
    const instance = registry.chosen(values.instance);
    return registry.drive(instance, args, () => sweep(instance, args, capture));
  });
