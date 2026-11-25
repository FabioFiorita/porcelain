import {
  repositoryReference,
  type RepositoryReference,
} from '@porcelain/client/links/rules';

export type MarkdownProps = Record<
  string,
  string | number | boolean | { textAlign: string }
>;

export type MarkdownRole =
  | 'alert-note'
  | 'alert-tip'
  | 'alert-important'
  | 'alert-warning'
  | 'alert-caution'
  | 'alert-title'
  | 'alert-content'
  | 'footnotes'
  | 'footnote-ref'
  | 'footnote-backref'
  | 'task';

export type MarkdownElement =
  | { kind: 'drop' }
  | { kind: 'unwrap' }
  | {
      kind: 'element';
      tag: string;
      props: MarkdownProps;
      empty: boolean;
      role?: MarkdownRole | undefined;
      language?: string | undefined;
      link?: RepositoryReference | undefined;
      source?: RepositoryReference | undefined;
      poster?: RepositoryReference | undefined;
    };

const EMPTY = new Set(['img', 'br', 'hr', 'input', 'source', 'wbr']);
const DROPPED = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
  'form',
  'button',
  'textarea',
  'select',
  'option',
  'link',
  'meta',
  'base',
  'frame',
  'frameset',
  'applet',
  'title',
  'head',
  'canvas',
  'dialog',
  'slot',
  'track',
  'portal',
]);
const KEPT = new Set([
  'a',
  'abbr',
  'audio',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'picture',
  'pre',
  's',
  'samp',
  'section',
  'small',
  'source',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
]);
const ALIGNED = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const CELLS = new Set(['td', 'th']);
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const ID = /^[A-Za-z][\w:.-]{0,127}$/;
const SIZE = /^(\d{1,5})(?:px)?$/;
const PERCENT = /^\d{1,3}%$/;
const LANGUAGE = /^[\w#+.-]{1,32}$/;
const ALERTS: Readonly<Record<string, MarkdownRole>> = {
  'markdown-alert markdown-alert-note': 'alert-note',
  'markdown-alert markdown-alert-tip': 'alert-tip',
  'markdown-alert markdown-alert-important': 'alert-important',
  'markdown-alert markdown-alert-warning': 'alert-warning',
  'markdown-alert markdown-alert-caution': 'alert-caution',
};

export function fragmentId(hash: string): string | undefined {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''));
  } catch {
    return undefined;
  }
}

function size(value: string | undefined): number | string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  const pixels = SIZE.exec(trimmed);
  if (pixels) return Number(pixels[1]);
  return PERCENT.test(trimmed) ? trimmed : undefined;
}

function textAlign(
  tag: string,
  attributes: Readonly<Record<string, string>>,
): string | undefined {
  const align = attributes.align?.trim().toLowerCase();
  if (align && ALIGNMENTS.has(align) && (ALIGNED.has(tag) || CELLS.has(tag)))
    return align;
  if (!CELLS.has(tag) && !ALIGNED.has(tag)) return undefined;
  const style =
    /(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i.exec(
      attributes.style ?? '',
    );
  return style?.[1]?.toLowerCase();
}

function role(
  tag: string,
  attributes: Readonly<Record<string, string>>,
): MarkdownRole | undefined {
  const className = (attributes.class ?? '').trim().replace(/\s+/g, ' ');
  const alert = ALERTS[className];
  if (tag === 'div' && alert) return alert;
  if (tag === 'p' && className === 'markdown-alert-title') return 'alert-title';
  if (tag === 'div' && className === 'markdown-alert-content')
    return 'alert-content';
  if (tag === 'section' && 'data-footnotes' in attributes) return 'footnotes';
  if (tag === 'a' && 'data-footnote-ref' in attributes) return 'footnote-ref';
  if (tag === 'a' && 'data-footnote-backref' in attributes)
    return 'footnote-backref';
  if (tag === 'input') return 'task';
  return undefined;
}

function firstCandidate(srcset: string): string {
  return srcset.trim().split(/[\s,]+/)[0] ?? '';
}

export function markdownElement(
  tagName: string,
  attributes: Readonly<Record<string, string>>,
  document: string,
): MarkdownElement {
  const tag = tagName.toLowerCase();
  if (DROPPED.has(tag)) return { kind: 'drop' };
  if (!KEPT.has(tag)) return { kind: 'unwrap' };
  if (tag === 'input' && attributes.type?.toLowerCase() !== 'checkbox')
    return { kind: 'drop' };
  const props: MarkdownProps = {};
  const resolve = (value: string | undefined) =>
    value === undefined ? undefined : repositoryReference(document, value);
  const id = attributes.id;
  if (id !== undefined && ID.test(id)) props.id = id;
  const title = attributes.title;
  if (title !== undefined && ['a', 'abbr', 'img'].includes(tag))
    props.title = title.slice(0, 300);
  if (tag === 'h2' && attributes.class?.trim() === 'sr-only')
    props.className = 'sr-only';
  const align = textAlign(tag, attributes);
  if (align) props.style = { textAlign: align };
  let link: RepositoryReference | undefined;
  let source: RepositoryReference | undefined;
  let poster: RepositoryReference | undefined;
  let language: string | undefined;
  switch (tag) {
    case 'a': {
      link = resolve(attributes.href);
      const label = attributes['aria-label'];
      if (label !== undefined) props['aria-label'] = label.slice(0, 300);
      break;
    }
    case 'img': {
      source = resolve(
        attributes.src ?? firstCandidate(attributes.srcset ?? ''),
      );
      props.alt = (attributes.alt ?? '').slice(0, 1000);
      const width = size(attributes.width);
      const height = size(attributes.height);
      if (width !== undefined) props.width = width;
      if (height !== undefined) props.height = height;
      break;
    }
    case 'source': {
      const value = attributes.src ?? firstCandidate(attributes.srcset ?? '');
      source = resolve(value);
      if (attributes.media !== undefined)
        props.media = attributes.media.slice(0, 300);
      if (
        attributes.type !== undefined &&
        /^[\w.+-]+\/[\w.+-]+$/.test(attributes.type)
      )
        props.type = attributes.type;
      break;
    }
    case 'video':
    case 'audio': {
      source = resolve(attributes.src);
      poster = tag === 'video' ? resolve(attributes.poster) : undefined;
      props.controls = true;
      props.preload = 'metadata';
      if ('loop' in attributes) props.loop = true;
      if ('muted' in attributes) props.muted = true;
      if (tag === 'video') {
        props.playsInline = true;
        const width = size(attributes.width);
        const height = size(attributes.height);
        if (width !== undefined) props.width = width;
        if (height !== undefined) props.height = height;
      }
      break;
    }
    case 'ol': {
      const start = attributes.start;
      if (start !== undefined && /^\d{1,9}$/.test(start))
        props.start = Number(start);
      break;
    }
    case 'td':
    case 'th': {
      for (const [name, prop] of [
        ['colspan', 'colSpan'],
        ['rowspan', 'rowSpan'],
      ] as const) {
        const value = attributes[name];
        if (value !== undefined && /^[1-9]\d{0,2}$/.test(value))
          props[prop] = Number(value);
      }
      break;
    }
    case 'details':
      if ('open' in attributes) props.open = true;
      break;
    case 'input':
      props.type = 'checkbox';
      props.disabled = true;
      props.checked = 'checked' in attributes;
      break;
    case 'pre': {
      const named = attributes['data-lang'];
      language =
        named !== undefined && LANGUAGE.test(named)
          ? named.toLowerCase()
          : 'text';
      break;
    }
  }
  return {
    kind: 'element',
    tag,
    props,
    empty: EMPTY.has(tag),
    role: role(tag, attributes),
    link,
    source,
    poster,
    language,
  };
}
