const missingStyleWarning =
  'No authored CSS was detected in the summary HTML. The review was published. Add CSS and republish, matching the reviewed application’s colors, background, typography and components where possible. Style the layer links and content hierarchy, then visually verify the result. If styles are generated at runtime, verify that they load correctly.';

const styleElement = /<style\b[^>]*>\s*[^<\s][\s\S]*?<\/style\s*>/i;
const styleAttribute =
  /<[^>]+\sstyle\s*=\s*(?:"[^"\s][^"]*"|'[^'\s][^']*'|[^\s"'=<>`]+)/i;
const stylesheetLink =
  /<link\b(?=[^>]*\brel\s*=\s*(?:"[^"<>]*\bstylesheet\b[^"<>]*"|'[^'<>]*\bstylesheet\b[^'<>]*'|stylesheet(?=\s|\/?>)))[^>]*>/i;

export function summaryStyleWarnings(html: string): string[] {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const authored =
    styleElement.test(markup) ||
    styleAttribute.test(markup) ||
    stylesheetLink.test(markup);
  return authored ? [] : [missingStyleWarning];
}
