import { externalLink } from '@porcelain/client/links/rules';

type MarkdownRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  url?: string;
};
export type MarkdownBlock = {
  id: number;
  kind: 'paragraph' | 'heading' | 'quote' | 'list' | 'code' | 'image';
  url?: string;
  level: number;
  runs: MarkdownRun[];
};

type InlineToken = MarkdownRun & {
  marker?: '*' | '_';
  remaining: number;
  openBold: number;
  closeBold: number;
  openItalic: number;
  closeItalic: number;
  separate: boolean;
};

function inline(source: string): MarkdownRun[] {
  const codeEnds = new Map<number, number>();
  const nextCode = new Map<number, number>();
  const codeWidths = new Map<number, number>();
  const backticks = [...source.matchAll(/`+/g)];
  for (let index = backticks.length - 1; index >= 0; index--) {
    const match = backticks[index];
    if (!match) continue;
    codeWidths.set(match.index, match[0].length);
    const next = nextCode.get(match[0].length);
    if (next !== undefined) codeEnds.set(match.index, next);
    nextCode.set(match[0].length, match.index);
  }
  const brackets: number[] = [];
  const parentheses: number[] = [];
  const ends = new Map<number, number>();
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '\\') index++;
    else if (char === '`' && codeEnds.has(index)) {
      const end = codeEnds.get(index) ?? index;
      index = end + (codeWidths.get(index) ?? 1) - 1;
    } else if (char === '[') brackets.push(index);
    else if (char === '(') parentheses.push(index);
    else if (char === ']' || char === ')') {
      const start = (char === ']' ? brackets : parentheses).pop();
      if (start !== undefined) ends.set(start, index);
    }
  }
  const tokens: InlineToken[] = [];
  const openers: Record<'*' | '_', InlineToken[]> = { '*': [], _: [] };
  let linkEnd = -1;
  let destinationEnd = -1;
  let url: string | undefined;
  const add = (text: string, code = false, separate = false) => {
    tokens.push({
      text,
      ...(code ? { code: true } : {}),
      ...(url ? { url } : {}),
      remaining: 0,
      openBold: 0,
      closeBold: 0,
      openItalic: 0,
      closeItalic: 0,
      separate,
    });
  };
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (index === linkEnd) {
      index = destinationEnd + 1;
      url = undefined;
      linkEnd = -1;
    } else if (char === '\\' && /[\\`*_[\]()]/.test(source[index + 1] ?? '')) {
      add(source[index + 1] ?? '', false, true);
      index += 2;
    } else if (char === '`') {
      let length = 1;
      while (source[index + length] === '`') length++;
      const end = codeEnds.get(index);
      if (end !== undefined) {
        add(source.slice(index + length, end), true, true);
        index = end + length;
      } else {
        add(source.slice(index, index + length));
        index += length;
      }
    } else if (char === '[' && linkEnd < 0) {
      const labelEnd = ends.get(index);
      const end =
        labelEnd !== undefined && source[labelEnd + 1] === '('
          ? ends.get(labelEnd + 1)
          : undefined;
      const destination =
        end !== undefined ? source.slice((labelEnd ?? 0) + 2, end) : '';
      if (
        labelEnd !== undefined &&
        end !== undefined &&
        destination &&
        !/\s/.test(destination)
      ) {
        linkEnd = labelEnd;
        destinationEnd = end;
        url = externalLink(destination) ? destination : undefined;
        index++;
      } else {
        add(char);
        index++;
      }
    } else if (char === '*' || char === '_') {
      let length = 1;
      while (source[index + length] === char) length++;
      const before = source[index - 1] ?? ' ';
      const after = source[index + length] ?? ' ';
      const beforeSpace = /\s/.test(before);
      const afterSpace = /\s/.test(after);
      const beforePunctuation =
        /[\x21-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7e]/.test(before);
      const afterPunctuation =
        /[\x21-\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7e]/.test(after);
      const left =
        !afterSpace && (!afterPunctuation || beforeSpace || beforePunctuation);
      const right =
        !beforeSpace && (!beforePunctuation || afterSpace || afterPunctuation);
      const canOpen = left && (char === '*' || !right || beforePunctuation);
      const canClose = right && (char === '*' || !left || afterPunctuation);
      const token: InlineToken = {
        text: char.repeat(length),
        marker: char,
        remaining: length,
        openBold: 0,
        closeBold: 0,
        openItalic: 0,
        closeItalic: 0,
        separate: false,
        ...(url ? { url } : {}),
      };
      tokens.push(token);
      const stack = openers[char];
      if (canClose) {
        while (token.remaining && stack.length) {
          const opener = stack.at(-1);
          if (!opener) break;
          const width = token.remaining >= 2 && opener.remaining >= 2 ? 2 : 1;
          opener.remaining -= width;
          token.remaining -= width;
          if (width === 2) {
            opener.openBold++;
            token.closeBold++;
          } else {
            opener.openItalic++;
            token.closeItalic++;
          }
          if (!opener.remaining) stack.pop();
        }
      }
      if (canOpen && token.remaining) stack.push(token);
      index += length;
    } else {
      const start = index++;
      while (
        index < source.length &&
        index !== linkEnd &&
        !/[\\`*_[]/.test(source[index] ?? '')
      )
        index++;
      add(source.slice(start, index));
    }
  }
  const runs: MarkdownRun[] = [];
  let bold = 0;
  let italic = 0;
  let separate = false;
  for (const token of tokens) {
    bold -= token.closeBold;
    italic -= token.closeItalic;
    const text = token.marker
      ? token.marker.repeat(token.remaining)
      : token.text;
    if (text) {
      const run = {
        text,
        ...(bold ? { bold: true } : {}),
        ...(italic ? { italic: true } : {}),
        ...(token.code ? { code: true } : {}),
        ...(token.url ? { url: token.url } : {}),
      };
      const previous = runs.at(-1);
      if (
        !separate &&
        !token.separate &&
        previous &&
        previous.bold === run.bold &&
        previous.italic === run.italic &&
        previous.code === run.code &&
        previous.url === run.url
      )
        previous.text += text;
      else runs.push(run);
      separate = token.separate;
    }
    bold += token.openBold;
    italic += token.openItalic;
  }
  return runs;
}

function imageUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function htmlAttribute(tag: string, name: string): string {
  const attributes = tag.matchAll(
    /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s<>]+)))?/g,
  );
  for (const attribute of attributes) {
    if (attribute[1]?.toLowerCase() === name)
      return (attribute[2] ?? attribute[3] ?? attribute[4] ?? '')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
  }
  return '';
}

function readerParts(
  source: string,
): { text: string; image?: string; alt?: string }[] {
  const parts: { text: string; image?: string; alt?: string }[] = [];
  const expression =
    /(`+)[\s\S]*?\1|!\[([^\]]*)\]\(<?([^\s]*?)>?(?:\s+"[^"]*")?\)|<!--[\s\S]*?-->|<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\4\s*>|<\/?[a-z][a-z0-9-]*(?:\s[^<>]*?)?\/?>/gi;
  let offset = 0;
  for (const match of source.matchAll(expression)) {
    parts.push({ text: source.slice(offset, match.index) });
    const token = match[0];
    let escapes = 0;
    for (let index = match.index - 1; source[index] === '\\'; index--)
      escapes++;
    if (match[1] || escapes % 2) parts.push({ text: token });
    else if (match[2] !== undefined)
      parts.push({
        text: '',
        image: imageUrl(match[3] ?? '') ?? '',
        alt: match[2],
      });
    else if (/^<img\b/i.test(token))
      parts.push({
        text: '',
        image: imageUrl(htmlAttribute(token, 'src')) ?? '',
        alt: htmlAttribute(token, 'alt'),
      });
    else if (/^<\/?summary\b/i.test(token)) parts.push({ text: '\n\n' });
    else if (/^<br\b/i.test(token)) parts.push({ text: '\n' });
    else if (/^<\/?(?:details|p|div)\b/i.test(token))
      parts.push({ text: '\n\n' });
    offset = match.index + token.length;
  }
  parts.push({ text: source.slice(offset) });
  return parts;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let code: string[] | undefined;
  let fence = '';
  const add = (source: string, kind: MarkdownBlock['kind'], level = 0) => {
    if (kind === 'code') {
      blocks.push({ id: blocks.length, kind, level, runs: [{ text: source }] });
      return;
    }
    const textBlock = (value: string) => {
      for (const part of value.split(/\n{2,}/)) {
        const text = part.replace(/^\n+|\n+$/g, '');
        if (text.trim() && !(kind === 'list' && text.trim() === '•'))
          blocks.push({ id: blocks.length, kind, level, runs: inline(text) });
      }
    };
    let text = '';
    for (const part of readerParts(source)) {
      text += part.text;
      if (part.image !== undefined) {
        textBlock(text);
        blocks.push({
          id: blocks.length,
          kind: 'image',
          level,
          runs: [{ text: part.alt || 'Image' }],
          ...(part.image ? { url: part.image } : {}),
        });
        text = '';
      }
    }
    textBlock(text);
  };
  const flush = () => {
    if (paragraph.length) add(paragraph.join('\n'), 'paragraph');
    paragraph = [];
  };
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  for (const line of lines) {
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
