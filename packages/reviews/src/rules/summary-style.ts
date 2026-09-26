import type { SummaryStyleWarning } from '../models/publish-review.ts';

const styleElement = /<style\b[^>]*>\s*[^<\s][\s\S]*?<\/style\s*>/i;
const styleAttribute =
  /<[^>]+\sstyle\s*=\s*(?:"[^"\s][^"]*"|'[^'\s][^']*'|[^\s"'=<>`]+)/i;
const stylesheetLink =
  /<link\b(?=[^>]*\brel\s*=\s*(?:"[^"<>]*\bstylesheet\b[^"<>]*"|'[^'<>]*\bstylesheet\b[^'<>]*'|stylesheet(?=\s|\/?>)))[^>]*>/i;

export function summaryStyleWarnings(html: string): SummaryStyleWarning[] {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const authored =
    styleElement.test(markup) ||
    styleAttribute.test(markup) ||
    stylesheetLink.test(markup);
  return authored ? [] : ['missing-style'];
}
