import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Recorder } from '../../../apps/server/spec/kit/isolated-server.ts';

const linkCode = /([#&?]c=)[^&\s"'`]+/g;
const bearer = /(Bearer\s+)[^\s"'`]+/gi;
const textFile = /\.(?:log|yml|yaml|md|txt)$/;
const withheld = 'a secret survived redaction, so the record was not written';

export type EvidenceFormat = 'json' | 'text';

export class Redactor {
  private readonly secrets: readonly string[];

  constructor(secrets: readonly string[]) {
    this.secrets = secrets;
  }

  recorder(): Recorder {
    const recorder = new Recorder();
    for (const secret of this.secrets) recorder.secret(secret);
    recorder.phase = 'request';
    return recorder;
  }

  known(text: string): string {
    return this.recorder().scrub(text);
  }

  text(text: string): string {
    const recorder = this.recorder();
    recorder.harvestText(text);
    return recorder
      .scrub(text)
      .replaceAll(linkCode, '$1[redacted]')
      .replaceAll(bearer, '$1[redacted]');
  }
}

export class Evidence {
  readonly folder: string;
  private readonly redactor: Redactor;
  private readonly format: EvidenceFormat;

  constructor(folder: string, redactor: Redactor, format: EvidenceFormat) {
    this.folder = folder;
    this.redactor = redactor;
    this.format = format;
  }

  async claim(name: string, extension: string): Promise<string> {
    await mkdir(this.folder, { recursive: true, mode: 0o700 });
    for (;;) {
      const names = await readdir(this.folder);
      const numbers = names.map((entry) =>
        Number(/^(\d+)-/.exec(entry)?.[1] ?? 0),
      );
      const number = String(Math.max(0, ...numbers) + 1).padStart(3, '0');
      const file = join(this.folder, `${number}-${name}.${extension}`);
      try {
        await writeFile(file, '', { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'EEXIST'
        )
          continue;
        throw error;
      }
      const rivals = (await readdir(this.folder)).filter(
        (entry) =>
          entry.startsWith(`${number}-`) &&
          entry !== `${number}-${name}.${extension}`,
      );
      if (rivals.length === 0) return file;
      await unlink(file);
      await sleep(5 + Math.floor(Math.random() * 20));
    }
  }

  sibling(claimed: string, extension: string): string {
    return claimed.replace(/\.[a-z]+$/, `.${extension}`);
  }

  async attach(claimed: string, extension: string, text: string) {
    const file = this.sibling(claimed, extension);
    await writeFile(file, this.redactor.text(text), {
      flag: 'wx',
      mode: 0o600,
    });
    return file;
  }

  async json(
    name: string,
    record: Record<string, unknown>,
    recorder: Recorder = this.redactor.recorder(),
  ): Promise<string> {
    const serialized = `${JSON.stringify(recorder.redact(record), null, 2)}\n`;
    const content =
      recorder.leaks(serialized) > 0
        ? `${JSON.stringify({ command: name, withheld }, null, 2)}\n`
        : serialized;
    const file = await this.claim(name, 'json');
    await writeFile(file, content, { mode: 0o600 });
    return file;
  }

  async write(file: string, command: readonly string[], output: string) {
    await writeFile(
      file,
      this.redactor.text(`$ cli ${command.join(' ')}\n\n${output}`),
      { mode: 0o600 },
    );
    return file;
  }

  async record(
    name: string,
    command: readonly string[],
    output: string,
  ): Promise<string> {
    if (this.format === 'json')
      return this.json(name, { command, output: this.redactor.text(output) });
    return this.write(await this.claim(name, 'txt'), command, output);
  }

  async note(name: string, text: string): Promise<string> {
    const file = join(this.folder, name);
    await mkdir(this.folder, { recursive: true, mode: 0o700 });
    await writeFile(file, this.redactor.text(text), { mode: 0o600 });
    return file;
  }

  async scrub(since = 0): Promise<void> {
    const entries = await readdir(this.folder, {
      recursive: true,
      withFileTypes: true,
    }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !textFile.test(entry.name)) continue;
      const file = join(entry.parentPath, entry.name);
      if ((await stat(file)).mtimeMs < since) continue;
      const text = await readFile(file, 'utf8');
      const redacted = this.redactor.text(text);
      if (redacted !== text) await writeFile(file, redacted);
    }
  }

  async listing(): Promise<string> {
    const names = (await readdir(this.folder)).toSorted();
    return `${this.folder}\n${names.map((entry) => `  ${entry}`).join('\n')}\n`;
  }
}
