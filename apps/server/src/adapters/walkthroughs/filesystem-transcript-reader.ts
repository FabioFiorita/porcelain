import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Effect, Layer, Predicate, Schema } from 'effect';
import { TranscriptReader } from '@porcelain/walkthroughs/ports';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';

const recordSchema = Schema.Struct({
  type: Schema.String,
  cwd: Schema.optional(Schema.String),
  isSidechain: Schema.optional(Schema.Boolean),
  isMeta: Schema.optional(Schema.Boolean),
  message: Schema.optional(Schema.Struct({ content: Schema.Unknown })),
  payload: Schema.optional(
    Schema.Struct({
      cwd: Schema.optional(Schema.String),
      source: Schema.optional(Schema.Unknown),
      type: Schema.optional(Schema.String),
      message: Schema.optional(Schema.String),
    }),
  ),
});
const decode = Schema.decodeUnknownOption(Schema.fromJsonString(recordSchema));
const textParts = Schema.decodeUnknownOption(
  Schema.Array(
    Schema.Struct({
      type: Schema.String,
      text: Schema.optional(Schema.String),
    }),
  ),
);
const ignored =
  /^(<command-|<system-reminder|<local-command|Caveat:|<task-notification|<environment_context|# AGENTS\.md)/;
export function humanTranscript(
  lines: readonly string[],
  folder: string,
  provider: 'claude' | 'codex',
): string {
  let acceptedCodex = false;
  const messages: string[] = [];
  for (const line of lines) {
    const decoded = decode(line);
    if (decoded._tag === 'None') continue;
    const entry = decoded.value;
    if (provider === 'codex' && entry.type === 'session_meta') {
      const source = entry.payload?.source;
      acceptedCodex =
        entry.payload?.cwd === folder &&
        !(Predicate.isObject(source) && 'subagent' in source);
      if (!acceptedCodex) return '';
    }
    let content = '';
    if (provider === 'codex') {
      if (
        acceptedCodex &&
        entry.type === 'event_msg' &&
        entry.payload?.type === 'user_message'
      )
        content = entry.payload.message ?? '';
    } else if (
      entry.type === 'user' &&
      entry.cwd === folder &&
      !entry.isSidechain &&
      !entry.isMeta
    ) {
      const value = entry.message?.content;
      if (typeof value === 'string') content = value;
      else {
        const parts = textParts(value);
        if (parts._tag === 'Some')
          content = parts.value
            .filter((part) => part.type === 'text')
            .map((part) => part.text ?? '')
            .join('\n');
      }
    }
    if (content.trim() && !ignored.test(content.trimStart()))
      messages.push(content.slice(0, 6000));
  }
  return messages.join('\n\n---\n\n').slice(0, 40000);
}
async function sessionFiles(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory())
        files.push(...(await sessionFiles(join(path, entry.name))));
      else if (entry.isFile() && entry.name.endsWith('.jsonl'))
        files.push(join(path, entry.name));
    }
    return files.sort();
  } catch (error) {
    if (Predicate.isObject(error) && 'code' in error && error.code === 'ENOENT')
      return [];
    throw error;
  }
}
export const filesystemTranscriptReaderLayer = (home = homedir()) =>
  Layer.succeed(TranscriptReader, {
    read: Effect.fn('TranscriptReader.read')((folder: string) =>
      Effect.tryPromise({
        try: async () => {
          const messages: string[] = [];
          for (const provider of ['claude', 'codex'] as const) {
            const root =
              provider === 'claude'
                ? join(
                    home,
                    '.claude',
                    'projects',
                    folder.replace(/[^a-zA-Z0-9-]/g, '-'),
                  )
                : join(home, '.codex', 'sessions');
            for (const file of await sessionFiles(root)) {
              const lines: string[] = [];
              let bytes = 0;
              const input = createReadStream(file, { encoding: 'utf8' });
              const reader = createInterface({ input, crlfDelay: Infinity });
              try {
                for await (const line of reader) {
                  const decoded = decode(line);
                  if (decoded._tag === 'None') continue;
                  if (
                    provider === 'codex' &&
                    decoded.value.type === 'session_meta'
                  ) {
                    const source = decoded.value.payload?.source;
                    if (
                      decoded.value.payload?.cwd !== folder ||
                      (Predicate.isObject(source) && 'subagent' in source)
                    )
                      break;
                  }
                  if (
                    ['session_meta', 'user', 'event_msg'].includes(
                      decoded.value.type,
                    ) &&
                    line.length <= 256000
                  ) {
                    lines.push(line);
                    bytes += line.length;
                    if (bytes >= 2 * 1024 * 1024) break;
                  }
                }
              } finally {
                reader.close();
                input.destroy();
              }
              const text = humanTranscript(lines, folder, provider);
              if (text) messages.push(text);
              if (messages.join('').length >= 40000)
                return messages.join('\n\n---\n\n').slice(0, 40000);
            }
          }
          return messages.join('\n\n---\n\n').slice(0, 40000);
        },
        catch: () =>
          new WalkthroughFailedError({
            kind: 'other',
            message: 'The build transcript could not be read.',
          }),
      }),
    ),
  });
