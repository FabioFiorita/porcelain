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
        url = isPreviewLink(destination) ? destination : undefined;
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
