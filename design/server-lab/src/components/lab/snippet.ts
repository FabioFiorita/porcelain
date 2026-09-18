// Finds the declaration a source reference points into, so a snippet shows one
// function, method, object member or route registration rather than a window.

const keywords =
  /^\s*(if|for|while|switch|catch|with|return|await|else|do|try|new|throw)\b/;
const declarations = [
  // export async function name(  |  export class Name  |  top-level const name: T =
  /^\s*(export\s+)?(default\s+)?(async\s+)?(function\*?\s+[\w$]+|abstract\s+class\s+[\w$]+|class\s+[\w$]+|interface\s+[\w$]+|type\s+[\w$]+|enum\s+[\w$]+)/,
  /^(export\s+)?(const|let|var)\s+[\w$]+(\s*:\s*[^=]+)?\s*=/,
  // class members: async name(args) {   run<T>(   get name() {
  /^\s*((public|private|protected|static|readonly|override|async|get|set)\s+)*#?[\w$]+\s*(<[^>]*>)?\s*\(([^)]*\)\s*(:\s*[^={;]+)?\s*\{)?\s*$/,
  // object members: name: (args) =>   name: async (args) =>
  /^\s*[\w$]+\s*:\s*(async\s+)?(\([^)]*\)?|[\w$]+)\s*(:\s*[^=]+)?=>/,
  // registrations: api.get(  server.addHook(  mcp.registerTool(
  /^\s*[\w$]+(\.withTypeProvider<[^>]+>\(\))?\.(get|post|put|patch|delete|all|route|register|addHook|registerTool|tool|resource)\s*\(/,
  // tests
  /^\s*(describe|it|test)(\.\w+)?\s*\(/,
];
const isDeclaration = (text: string) =>
  !keywords.test(text) && declarations.some((pattern) => pattern.test(text));

/** Last line of the statement that starts at `start` (1-based), by bracket depth. */
function statementEnd(lines: string[], start: number): number | undefined {
  let depth = 0;
  let opened = false;
  let quote: string | undefined;
  let blockComment = false;
  for (
    let index = start - 1;
    index < lines.length && index < start + 300;
    index++
  ) {
    const text = lines[index] ?? '';
    for (let column = 0; column < text.length; column++) {
      const char = text[column];
      const next = text[column + 1];
      if (blockComment) {
        if (char === '*' && next === '/') {
          blockComment = false;
          column++;
        }
        continue;
      }
      if (quote) {
        if (char === '\\') column++;
        else if (char === quote) quote = undefined;
        continue;
      }
      if (char === '/' && next === '/') break;
      if (char === '/' && next === '*') {
        blockComment = true;
        column++;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '{' || char === '(' || char === '[') {
        depth++;
        opened = true;
      } else if (char === '}' || char === ')' || char === ']') {
        depth--;
        // Walked out of the construct we started in.
        if (depth < 0) return index + 1;
      }
    }
    if (quote && quote !== '`') quote = undefined;
    const trimmed = text.trim();
    if (
      depth === 0 &&
      (opened || /[;,]$/.test(trimmed)) &&
      /[;,})\]]$/.test(trimmed)
    )
      return index + 1;
  }
  return undefined;
}

function withLeadingComments(lines: string[], start: number) {
  let first = start;
  while (first > 1) {
    const previous = (lines[first - 2] ?? '').trim();
    if (/^(\/\/|\/\*\*?|\*|@)/.test(previous)) first--;
    else break;
  }
  return first;
}

export function enclosingSnippet(content: string, line: number) {
  const lines = content.split('\n');
  const target = Math.min(Math.max(1, line), lines.length);
  for (
    let candidate = target;
    candidate >= Math.max(1, target - 250);
    candidate--
  ) {
    if (!isDeclaration(lines[candidate - 1] ?? '')) continue;
    const end = statementEnd(lines, candidate);
    if (end !== undefined && end >= target && end - candidate < 300)
      return { start: withLeadingComments(lines, candidate), end };
    // A very long declaration referenced at its start: show its opening.
    if (candidate === target)
      return {
        start: withLeadingComments(lines, target),
        end: Math.min(lines.length, target + 40),
      };
  }
  return {
    start: Math.max(1, target - 6),
    end: Math.min(lines.length, target + 24),
  };
}
