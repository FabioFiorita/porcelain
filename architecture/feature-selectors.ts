export function selectorAppears(source: string, selector: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = new RegExp(`(['"\x60])${escaped}\\1`);
  if (quoted.test(source)) return true;
  const before = /^[\w$-]/.test(selector) ? '(?<![\\w$-])' : '';
  const after = /[\w$-]$/.test(selector) ? '(?![\\w$-])' : '';
  const bounded = new RegExp(`${before}${escaped}${after}`);
  return bounded.test(source);
}
