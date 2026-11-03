import { Schema } from 'effect';
import { fileURLToPath } from 'node:url';

export const watchHostCommandSchema = Schema.Struct({
  command: Schema.String,
  args: Schema.Array(Schema.String),
});

export type WatchHostCommand = typeof watchHostCommandSchema.Type;

export function watchHostEntry(moduleUrl: string = import.meta.url): string {
  const source = moduleUrl.endsWith('.ts');
  return fileURLToPath(
    new URL(`../bootstrap/watch-host.${source ? 'ts' : 'mjs'}`, moduleUrl),
  );
}

export function nodeWatchHost(): WatchHostCommand {
  return { command: process.execPath, args: [watchHostEntry()] };
}
