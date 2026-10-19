export function omittedReasonText(reasons: readonly string[]) {
  return [...new Set(reasons)].join(', ');
}
