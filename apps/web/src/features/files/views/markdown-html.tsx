import { renderHtml } from '@tanstack/markdown/html';
import { parseMarkdown } from '@tanstack/markdown/parser';
import type {
  MarkdownDocument,
  MarkdownExtension,
  MarkdownHeading,
} from '@tanstack/markdown';
import { headingCollectionExtension } from '@tanstack/markdown/extensions/headings';
import type { ReactNode } from 'react';
import {
  markdownElement,
  type MarkdownElement,
} from '../rules/markdown-element';

export type MarkdownElementNode = Extract<MarkdownElement, { kind: 'element' }>;
export type RenderMarkdownElement = (
  element: MarkdownElementNode,
  children: ReactNode[],
  key: number,
) => ReactNode;

const ALERTS = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;

const quotes: MarkdownExtension = {
  name: 'porcelain-quotes',
  parseBlock(context) {
    if (!/^ {0,3}>/.test(context.lines[context.index] ?? '')) return undefined;
    const body: string[] = [];
    let cursor = context.index;
    while (cursor < context.lines.length) {
      const quoted = /^ {0,3}>\s?(.*)$/.exec(context.lines[cursor] ?? '');
      if (!quoted) break;
      body.push(quoted[1] ?? '');
      cursor += 1;
    }
    context.consume(cursor - context.index);
    const alert = ALERTS.exec(body[0] ?? '');
    const kind = alert?.[1]?.toLowerCase();
    if (kind)
      return {
        type: 'callout',
        kind,
        title: kind.slice(0, 1).toUpperCase() + kind.slice(1),
        children: context.parseBlocks(body.slice(1).join('\n')),
      };
    return {
      type: 'blockquote',
      children: context.parseBlocks(body.join('\n')),
    };
  },
};

const extensions = [quotes, headingCollectionExtension()];

export type MarkdownOutline = readonly MarkdownHeading[];

export function parseMarkdownDocument(source: string): MarkdownDocument {
  return parseMarkdown(source, { allowHtml: true, extensions });
}

export function markdownHtml(
  source: string | MarkdownDocument,
  document: string,
  render: RenderMarkdownElement,
): ReactNode[] {
  const parsed = new DOMParser().parseFromString(
    renderHtml(
      typeof source === 'string' ? parseMarkdownDocument(source) : source,
      {
        allowHtml: true,
        extensions,
      },
    ),
    'text/html',
  );
  const children = (node: Node): ReactNode[] =>
    Array.from(node.childNodes, (child, key) => walk(child, key));
  const walk = (node: Node, key: number): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      return node.parentElement?.tagName === 'DETAILS' && text.trim()
        ? markdownHtml(text, document, render)
        : text;
    }
    if (!(node instanceof Element)) return null;
    const attributes: Record<string, string> = {};
    for (const attribute of Array.from(node.attributes))
      attributes[attribute.name.toLowerCase()] = attribute.value;
    const element = markdownElement(node.tagName, attributes, document);
    if (element.kind === 'drop') return null;
    if (element.kind === 'unwrap') return children(node);
    return render(element, element.empty ? [] : children(node), key);
  };
  return children(parsed.body);
}
