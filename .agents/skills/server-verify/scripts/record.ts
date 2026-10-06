import { readFile } from 'node:fs/promises';
import { Refusal, Usage } from '../../verify-core/cli.ts';
import { registry, type ServerInstance } from './instance.ts';

export type RecordInput = {
  body?: string;
  headers?: string;
  transcript?: string;
  request?: string;
  status?: number;
  transport?: 'network' | 'owner';
};

async function read(path: string, kind: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new Refusal(`could not read the ${kind} file`);
  }
}

function jsonOrText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function capturedHeaders(text: string) {
  const blocks: { status: number; headers: Map<string, string> }[] = [];
  let current: (typeof blocks)[number] | undefined;
  let previous: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const status = /^HTTP\/\d+(?:\.\d+)?\s+(\d{3})(?:\s|$)/i.exec(line);
    if (status?.[1]) {
      const code = Number(status[1]);
      if (code < 100 || code > 599)
        throw new Usage('the headers file has an invalid HTTP status');
      current = { status: code, headers: new Map() };
      blocks.push(current);
      previous = undefined;
      continue;
    }
    if (!current) {
      if (line.trim() !== '')
        throw new Usage('the headers file must contain raw HTTP headers');
      continue;
    }
    if (line.trim() === '') {
      previous = undefined;
      continue;
    }
    if (/^\s/.test(line) && previous !== undefined) {
      current.headers.set(
        previous,
        `${current.headers.get(previous) ?? ''} ${line.trim()}`,
      );
      continue;
    }
    const header = /^([^\s:]+):\s*(.*)$/.exec(line);
    if (!header?.[1] || header[2] === undefined)
      throw new Usage('the headers file must contain raw HTTP headers');
    const key = header[1].toLowerCase();
    const existing = current.headers.get(key);
    current.headers.set(
      key,
      existing === undefined ? header[2] : `${existing}\n${header[2]}`,
    );
    previous = key;
  }
  const final = blocks.at(-1);
  if (!final) throw new Usage('the headers file has no HTTP status');
  return {
    blocks: blocks.map((block) => Object.fromEntries(block.headers)),
    final: { status: final.status, headers: Object.fromEntries(final.headers) },
  };
}

export async function record(
  instance: ServerInstance,
  label: string,
  input: RecordInput,
): Promise<string> {
  if ((input.body === undefined) === (input.transcript === undefined))
    throw new Usage('record takes exactly one body file or transcript file');
  if (
    input.status !== undefined &&
    (!Number.isInteger(input.status) ||
      input.status < 100 ||
      input.status > 599)
  )
    throw new Usage('record status must be an HTTP status from 100 to 599');
  if (
    input.transport !== undefined &&
    input.transport !== 'network' &&
    input.transport !== 'owner'
  )
    throw new Usage('record transport must be network or owner');
  if (
    input.transcript !== undefined &&
    (input.headers !== undefined || input.status !== undefined)
  )
    throw new Usage('headers and status apply to a body file');

  const recorder = registry.redactor(instance).recorder();
  const harvestText = (text: string) => {
    recorder.harvestText(text);
    for (const [, secret] of text.matchAll(/\bBearer\s+([^\s"'`]+)/gi))
      if (secret !== undefined) recorder.secret(secret);
    for (const [, secret] of text.matchAll(/[#&?]c=([^&\s"'`]+)/g))
      if (secret !== undefined) recorder.secret(secret);
    for (const [, kind, cookie] of text.matchAll(
      /^\s*(set-cookie|cookie):\s*(.+)$/gim,
    )) {
      if (cookie === undefined) continue;
      const parts = cookie.split(';');
      const values =
        kind?.toLowerCase() === 'set-cookie' ? parts.slice(0, 1) : parts;
      for (const part of values) {
        const equals = part.indexOf('=');
        if (equals !== -1) recorder.secret(part.slice(equals + 1).trim());
      }
    }
  };
  harvestText(label);
  if (input.request !== undefined) harvestText(input.request);

  let capture: Record<string, unknown>;
  if (input.body !== undefined) {
    const text = await read(input.body, 'body');
    harvestText(text);
    const body = jsonOrText(text);
    let status = input.status;
    let headers: Record<string, string> = {};
    if (input.headers !== undefined) {
      const raw = await read(input.headers, 'headers');
      const captured = capturedHeaders(raw);
      harvestText(raw);
      recorder.harvest(captured.blocks);
      if (status !== undefined && status !== captured.final.status)
        throw new Refusal(
          'reported status conflicts with the captured HTTP status',
        );
      status = captured.final.status;
      headers = captured.final.headers;
    }
    capture = { response: { status, headers, body } };
  } else {
    if (input.transcript === undefined)
      throw new Usage('record takes a transcript file');
    const text = await read(input.transcript, 'transcript');
    harvestText(text);
    recorder.harvest(jsonOrText(text));
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    let isJsonLines = lines.length > 0;
    const entries = lines.map((line) => {
      try {
        const entry: unknown = JSON.parse(line);
        recorder.harvest(entry);
        return entry;
      } catch {
        isJsonLines = false;
        return line;
      }
    });
    capture = { transcript: isJsonLines ? entries : text };
  }
  const file = await registry.evidence(instance).json(
    'record',
    {
      label,
      reportedRequest: input.request,
      transport: input.transport ?? 'network',
      ...capture,
    },
    recorder,
  );
  return `evidence ${file}\n`;
}
