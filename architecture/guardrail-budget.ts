export const ARCHITECTURE_LINE_BUDGET = 18_000;

export function architectureLines(sources: readonly string[]): number {
  return sources.reduce((count, source) => {
    const newlines = source.split('\n').length - 1;
    return (
      count + newlines + (source.length > 0 && !source.endsWith('\n') ? 1 : 0)
    );
  }, 0);
}
