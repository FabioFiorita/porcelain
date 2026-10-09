import { isPreviewLink } from './preview-link.ts';

type MarkdownRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  url?: string;
};
export type MarkdownBlock = {
  id: number;
  kind: 'paragraph' | 'heading' | 'quote' | 'list' | 'code';
  level: number;
  runs: MarkdownRun[];
};

function inline(source: string): MarkdownRun[] {
  const pattern =
    /\\([\\`*_[\]])|(`+)([\s\S]*?)\2(?!`)|\[([^\]]+)\]\(([^\s)]+)\)|(\*\*)(?!\s)([\s\S]+?)(?<!\s)\6(?!\*)|(?<![^\s\x21-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7e])(__)(?!\s)([\s\S]+?)(?<!\s)\8(?![^\s\x21-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7e])|(?<!\*)(\*)(?![\s*])([^\n]+?)(?<![\s*])\10(?!\*)|(?<![^\s\x21-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7e])(_)(?![\s_])([^\n]+?)(?<!\s)\12(?![^\s\x21-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7e])/g;
  const runs: MarkdownRun[] = [];
  let at = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > at) runs.push({ text: source.slice(at, match.index) });
    if (match[1]) runs.push({ text: match[1] });
    else if (match[2]) runs.push({ text: match[3] ?? '', code: true });
    else if (match[4])
      runs.push(
        ...inline(match[4]).map((run) => ({
          ...run,
          ...(isPreviewLink(match[5] ?? '') ? { url: match[5] } : {}),
        })),
      );
    else if (match[6] || match[8])
      runs.push(
        ...inline(match[7] ?? match[9] ?? '').map((run) => ({
          ...run,
          bold: true,
        })),
      );
    else
      runs.push(
        ...inline(match[11] ?? match[13] ?? '').map((run) => ({
          ...run,
          italic: true,
        })),
      );
    at = match.index + match[0].length;
  }
  if (at < source.length) runs.push({ text: source.slice(at) });
  return runs;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let code: string[] | undefined;
  let fence = '';
  const add = (text: string, kind: MarkdownBlock['kind'], level = 0) => {
    blocks.push({
      id: blocks.length,
      kind,
      level,
      runs: kind === 'code' ? [{ text }] : inline(text),
    });
  };
  const flush = () => {
    if (paragraph.length) add(paragraph.join('\n'), 'paragraph');
    paragraph = [];
  };
  for (const line of source.replaceAll('\r\n', '\n').split('\n')) {
    if (code) {
      if (
        line.trimEnd().length >= fence.length &&
        line
          .trimEnd()
          .split('')
          .every((char) => char === fence[0])
      ) {
        add(code.join('\n'), 'code');
        code = undefined;
      } else code.push(line);
      continue;
    }
    const opening = /^(\x60{3,}|~{3,})/.exec(line);
    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (opening) {
      flush();
      fence = opening[1] ?? '';
      code = [];
    } else if (!line.trim()) flush();
    else if (heading) {
      flush();
      add(heading[2] ?? '', 'heading', heading[1]?.length);
    } else if (line.startsWith('> ')) {
      flush();
      add(line.slice(2), 'quote');
    } else if (/^[-*] /.test(line)) {
      flush();
      add(`• ${line.slice(2)}`, 'list');
    } else paragraph.push(line);
  }
  flush();
  if (code) add(code.join('\n'), 'code');
  return blocks;
}
