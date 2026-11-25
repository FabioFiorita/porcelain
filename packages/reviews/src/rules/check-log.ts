import type { CheckLogExcerpt, CheckLogLine } from '../models/pull-request.ts';

export const CHECK_LOG_LINES = 200;
export const CHECK_LOG_BYTES = 64 * 1024;
const LINE_CHARS = 2000;
const STAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) ?/;
const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ESCAPES = new RegExp(
  `${ESC}\\[[0-?]*[ -/]*[@-~]|${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)|${ESC}[@-Z\\\\-_]`,
  'g',
);

function utf8Length(text: string) {
  let length = 0;
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) length += 1;
    else if (unit < 0x800) length += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      length += 4;
      index++;
    } else length += 3;
  }
  return length;
}

function classify(text: string): CheckLogLine | undefined {
  const plain = text.replace(ESCAPES, '').replace(/\r$/, '');
  const marker = /^##\[(\w+)\](.*)$/.exec(plain);
  const clipped = (value: string) =>
    value.length > LINE_CHARS ? `${value.slice(0, LINE_CHARS)}…` : value;
  if (!marker) return { text: clipped(plain), level: 'plain' };
  const [, kind = '', rest = ''] = marker;
  if (kind === 'endgroup' || kind === 'debug') return undefined;
  if (kind === 'error') return { text: clipped(rest), level: 'error' };
  if (kind === 'warning') return { text: clipped(rest), level: 'warning' };
  if (kind === 'group') return { text: clipped(rest), level: 'group' };
  if (kind === 'command') return { text: clipped(rest), level: 'command' };
  return { text: clipped(rest), level: 'plain' };
}

export function checkLogExcerpt(
  log: string,
  window: { from?: string | undefined; to?: string | undefined } = {},
  limits: { lines: number; bytes: number } = {
    lines: CHECK_LOG_LINES,
    bytes: CHECK_LOG_BYTES,
  },
): CheckLogExcerpt {
  const from = window.from === undefined ? NaN : Date.parse(window.from);
  const to = window.to === undefined ? NaN : Date.parse(window.to) + 1000;
  const windowed = Number.isFinite(from);
  const all: { stamp: number; text: string }[] = [];
  let stamp = NaN;
  for (const raw of log.split('\n')) {
    const match = STAMP.exec(raw);
    if (match?.[1] !== undefined) stamp = Date.parse(match[1]);
    all.push({ stamp, text: match ? raw.slice(match[0].length) : raw });
  }
  if (all.at(-1)?.text === '') all.pop();
  const inStep = windowed
    ? all.filter(
        (line) =>
          line.stamp >= from && (!Number.isFinite(to) || line.stamp < to),
      )
    : [];
  const source = inStep.length > 0 ? 'step' : 'job';
  const lines = (source === 'step' ? inStep : all).flatMap((line) => {
    const classified = classify(line.text);
    return classified ? [classified] : [];
  });
  const lastError = lines.findLastIndex((line) => line.level === 'error');
  let end = lastError === -1 ? lines.length : lastError + 1;
  while (
    lastError !== -1 &&
    end < Math.min(lines.length, lastError + 4) &&
    lines[end]?.level !== 'group'
  )
    end++;
  let start = Math.max(0, end - limits.lines);
  let bytes = 0;
  for (let index = end - 1; index >= start; index--) {
    bytes += utf8Length(lines[index]?.text ?? '') + 1;
    if (bytes > limits.bytes) {
      start = index + 1;
      break;
    }
  }
  return { source, lines: lines.slice(start, end), omitted: start };
}
