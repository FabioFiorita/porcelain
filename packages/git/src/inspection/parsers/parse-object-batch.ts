const HEADER = /^[0-9a-f]+ \w+ (\d+)$/u;

export function parseObjectBatch(
  output: Buffer,
  oids: readonly string[],
): Map<string, string> {
  const bodies = new Map<string, string>();
  let offset = 0;
  for (const oid of oids) {
    const headerEnd = output.indexOf('\n', offset);
    if (headerEnd < 0) break;
    const header = output.subarray(offset, headerEnd).toString('utf8');
    offset = headerEnd + 1;
    if (header.endsWith(' missing')) continue;
    const size = HEADER.exec(header)?.[1];
    if (size === undefined) break;
    const end = offset + Number(size);
    if (end > output.length) break;
    bodies.set(oid, output.subarray(offset, end).toString('utf8'));
    offset = end + 1;
  }
  return bodies;
}
