import { renderHtml } from '@tanstack/markdown/html';
import {
  type MarkdownComponents,
  renderMarkdownReact,
} from '@tanstack/markdown/react';
import { createElement, type ReactNode } from 'react';
import { externalLink } from '@porcelain/client/links/rules';

const allowed = new Set([
  'details',
  'summary',
  'img',
  'br',
  'p',
  'div',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'sup',
  'sub',
  'kbd',
  'input',
]);
const hidden = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
]);

export function markdownHtml(
  source: string,
  components: MarkdownComponents,
): ReactNode {
  const document = new DOMParser().parseFromString(
    renderHtml(source, { allowHtml: true }),
    'text/html',
  );
  const children = (node: Node): ReactNode[] =>
    Array.from(node.childNodes, (child, key) => render(child, key));
  const render = (node: Node, key: number): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      return node.parentElement?.tagName === 'DETAILS' && text.trim()
        ? renderMarkdownReact(text, { components })
        : text;
    }
    if (!(node instanceof Element)) return null;
    const tag = node.tagName.toLowerCase();
    if (hidden.has(tag)) return null;
    if (!allowed.has(tag)) return children(node);
    const props: Record<string, string | number | boolean> = { key };
    if (tag === 'input') {
      if (node.getAttribute('type') !== 'checkbox') return null;
      props.type = 'checkbox';
      props.disabled = true;
      props.checked = node.hasAttribute('checked');
    }
    if (tag === 'ol' && /^\d+$/.test(node.getAttribute('start') ?? ''))
      props.start = Number(node.getAttribute('start'));
    const id = node.getAttribute('id');
    if (id && /^[A-Za-z][\w:.-]*$/.test(id)) props.id = id;
    if (tag === 'img') {
      props.src = node.getAttribute('src') ?? '';
      props.alt = node.getAttribute('alt') ?? '';
    }
    if (tag === 'a') {
      const href = node.getAttribute('href') ?? '';
      if (externalLink(href) || /^(?:#[^\s]*|\/(?![/\\])[^\s]*)$/.test(href))
        props.href = href;
    }
    if (tag === 'pre')
      props['data-lang'] = node.getAttribute('data-lang') ?? 'text';
    return createElement(
      components[tag] ?? tag,
      props,
      ...(['img', 'br', 'hr', 'input'].includes(tag) ? [] : children(node)),
    );
  };
  return children(document.body);
}
